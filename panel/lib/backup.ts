import archiver from "archiver";
import extract from "extract-zip";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { config, isGDriveConfigured } from "./config";
import { saveOff, saveOn } from "./rcon";
import { getStatus, stopServer, startServer } from "./docker";
import * as gdrive from "./gdrive";
import {
  insertBackup,
  getBackup,
  deleteBackup,
  listBackupsOlderThan,
  BackupRow,
} from "./db";
import { resolveWorldDir, invalidateWorldDirCache } from "./nbt-reader";

function worldPath(): string {
  return resolveWorldDir();
}
function tmpDir(): string {
  const d = path.join(config.dataDir, "tmp");
  fs.mkdirSync(d, { recursive: true });
  return d;
}
// Persistent local backup storage on the VPS (survives until retention cleanup).
function backupsDir(): string {
  const d = path.join(config.dataDir, "backups");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Where a backup's zip lives locally, checking the legacy tmp location too.
function localBackupFile(filename: string): string | null {
  for (const dir of [backupsDir(), tmpDir()]) {
    const p = path.join(dir, filename);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Move a directory, falling back to copy+delete when src and dst live on
// different filesystems (rename() throws EXDEV across mount points, e.g.
// tmp on the app volume vs. the world on the mounted data volume).
export async function moveDir(src: string, dst: string): Promise<void> {
  try {
    await fsp.rename(src, dst);
  } catch (e: any) {
    if (e?.code !== "EXDEV") throw e;
    await fsp.cp(src, dst, { recursive: true });
    await fsp.rm(src, { recursive: true, force: true });
  }
}

async function zipDir(srcDir: string, outFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", reject);
    archive.pipe(output);
    // Store world contents under "<worldname>/" inside the zip.
    archive.directory(srcDir, path.basename(srcDir));
    archive.finalize();
  });
}

export interface BackupResult {
  id: number;
  filename: string;
  sizeBytes: number;
  uploaded: boolean;
  gdriveId: string | null;
}

// Create a backup: flush saves, zip the world into local storage,
// optionally mirror to Drive, record in DB.
export async function createBackup(
  type: "manual" | "scheduled" = "manual"
): Promise<BackupResult> {
  const world = worldPath();
  if (!fs.existsSync(path.join(world, "level.dat"))) {
    throw new Error(`World folder not found (looked at ${world})`);
  }

  const status = await getStatus();
  const wasRunning = status.running;

  // Quiesce world writes if server is up.
  if (wasRunning) {
    try {
      await saveOff();
    } catch {
      /* if RCON down, proceed anyway */
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${path.basename(world)}-${stamp}.zip`;
  const localZip = path.join(backupsDir(), filename);

  let sizeBytes = 0;
  try {
    sizeBytes = await zipDir(world, localZip);
  } finally {
    if (wasRunning) {
      try {
        await saveOn();
      } catch {}
    }
  }

  let gdriveId: string | null = null;
  let uploaded = false;
  if (isGDriveConfigured()) {
    try {
      const up = await gdrive.uploadFile(localZip, filename);
      gdriveId = up.id;
      uploaded = true;
    } catch (e) {
      // Local copy still exists; Drive is just a mirror.
    }
  }

  const id = insertBackup({
    filename,
    gdrive_file_id: gdriveId,
    size_bytes: sizeBytes,
    type,
    status: uploaded ? "complete" : "local",
  });

  return { id, filename, sizeBytes, uploaded, gdriveId };
}

// Locate the world root inside an extracted backup: level.dat at the top,
// or in the first subdirectory that has one.
async function findExtractedWorld(stagingDir: string): Promise<string | null> {
  if (fs.existsSync(path.join(stagingDir, "level.dat"))) return stagingDir;
  const entries = await fsp.readdir(stagingDir, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && fs.existsSync(path.join(stagingDir, e.name, "level.dat"))) {
      return path.join(stagingDir, e.name);
    }
  }
  return null;
}

// Restore: stop server, swap world dir with backup contents, restart.
export async function restoreBackup(id: number): Promise<void> {
  const row = getBackup(id);
  if (!row) throw new Error("backup not found");

  const status = await getStatus();
  const wasRunning = status.running;

  // Get the zip locally — prefer the VPS copy, fall back to Drive.
  let localZip = localBackupFile(row.filename);
  let fromDrive = false;
  if (!localZip) {
    if (!row.gdrive_file_id) {
      throw new Error("local backup file missing and no Drive copy");
    }
    localZip = path.join(tmpDir(), `restore-${row.filename}`);
    await gdrive.downloadFile(row.gdrive_file_id, localZip);
    fromDrive = true;
  }

  // Extract to staging first so a corrupt zip never touches the live world.
  const staging = path.join(tmpDir(), `restore-${Date.now()}`);
  await fsp.mkdir(staging, { recursive: true });

  try {
    await extract(localZip, { dir: path.resolve(staging) });
    const extractedWorld = await findExtractedWorld(staging);
    if (!extractedWorld) {
      throw new Error("backup zip does not contain a world (no level.dat)");
    }

    // Stop server before touching world files.
    if (wasRunning) {
      await stopServer();
    }

    const world = worldPath();
    const backupOld = `${world}.pre-restore-${Date.now()}`;

    // Move current world aside (safety), move staged world in, drop old on success.
    if (fs.existsSync(world)) {
      await moveDir(world, backupOld);
    }
    try {
      await moveDir(extractedWorld, world);
      await fsp.rm(backupOld, { recursive: true, force: true }).catch(() => {});
    } catch (e) {
      // Roll back.
      await fsp.rm(world, { recursive: true, force: true }).catch(() => {});
      if (fs.existsSync(backupOld)) await moveDir(backupOld, world);
      throw e;
    }

    invalidateWorldDirCache();

    if (wasRunning) {
      await startServer();
    }
  } finally {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    if (fromDrive) await fsp.unlink(localZip).catch(() => {});
  }
}

export async function removeBackup(id: number): Promise<void> {
  const row = getBackup(id);
  if (!row) return;
  const local = localBackupFile(row.filename);
  if (local) await fsp.unlink(local).catch(() => {});
  if (row.gdrive_file_id) {
    await gdrive.deleteFile(row.gdrive_file_id).catch(() => {});
  }
  deleteBackup(id);
}

// Delete local backup zips older than the retention window. Backups mirrored
// to Drive keep their DB row (cloud copy stays restorable); local-only
// backups are removed entirely.
export async function cleanupOldBackups(
  days: number = config.backupRetentionDays
): Promise<number> {
  if (!days || days <= 0) return 0;
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows = listBackupsOlderThan(cutoff);
  let removed = 0;
  for (const row of rows) {
    const local = localBackupFile(row.filename);
    if (local) {
      try {
        await fsp.unlink(local);
      } catch (e: any) {
        // Keep the DB row so the backup stays visible until the file is gone.
        console.error(`[backup] retention: failed to delete ${local}:`, e?.message);
        continue;
      }
    }
    if (!row.gdrive_file_id) {
      deleteBackup(row.id);
      removed++;
    }
  }
  if (removed > 0) console.log(`[backup] retention: removed ${removed} backup(s) older than ${days}d`);
  return removed;
}

export function backupLink(row: BackupRow): string | null {
  return row.gdrive_file_id ? gdrive.driveLink(row.gdrive_file_id) : null;
}
