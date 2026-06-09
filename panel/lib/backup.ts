import archiver from "archiver";
import extract from "extract-zip";
import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { config, isGDriveConfigured } from "./config";
import { saveOff, saveOn } from "./rcon";
import { getStatus, stopServer, startServer } from "./docker";
import * as gdrive from "./gdrive";
import { insertBackup, getBackup, deleteBackup, BackupRow } from "./db";

function worldPath(): string {
  return path.join(config.mcDataPath, config.worldName);
}
function tmpDir(): string {
  const d = path.join(config.dataDir, "tmp");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

async function zipDir(srcDir: string, outFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outFile);
    const archive = archiver("zip", { zlib: { level: 6 } });
    output.on("close", () => resolve(archive.pointer()));
    archive.on("error", reject);
    archive.pipe(output);
    // Store world contents under "world/" inside the zip.
    archive.directory(srcDir, config.worldName);
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

// Create a backup: flush saves, zip the world, upload to Drive, record in DB.
export async function createBackup(
  type: "manual" | "scheduled" = "manual"
): Promise<BackupResult> {
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
  const filename = `${config.worldName}-${stamp}.zip`;
  const localZip = path.join(tmpDir(), filename);

  let sizeBytes = 0;
  try {
    sizeBytes = await zipDir(worldPath(), localZip);
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
      // Keep local copy if upload fails; record as local-only.
    }
  }

  const id = insertBackup({
    filename,
    gdrive_file_id: gdriveId,
    size_bytes: sizeBytes,
    type,
    status: uploaded ? "complete" : "local-only",
  });

  // Remove local temp zip only if it's safely in Drive.
  if (uploaded) {
    await fsp.unlink(localZip).catch(() => {});
  }

  return { id, filename, sizeBytes, uploaded, gdriveId };
}

// Restore: stop server, replace world dir with backup contents, restart.
export async function restoreBackup(id: number): Promise<void> {
  const row = getBackup(id);
  if (!row) throw new Error("backup not found");

  const status = await getStatus();
  const wasRunning = status.running;

  // Get the zip locally.
  let localZip: string;
  if (row.gdrive_file_id) {
    localZip = path.join(tmpDir(), `restore-${row.filename}`);
    await gdrive.downloadFile(row.gdrive_file_id, localZip);
  } else {
    localZip = path.join(tmpDir(), row.filename);
    if (!fs.existsSync(localZip)) {
      throw new Error("local backup file missing and no Drive copy");
    }
  }

  // Stop server before touching world files.
  if (wasRunning) {
    await stopServer();
  }

  const world = worldPath();
  const backupOld = `${world}.pre-restore-${Date.now()}`;

  // Move current world aside (safety), extract new, then drop old on success.
  if (fs.existsSync(world)) {
    await fsp.rename(world, backupOld);
  }
  try {
    await extract(localZip, { dir: path.resolve(config.mcDataPath) });
    // Zip contains world/ at root -> extracted to correct place.
    await fsp.rm(backupOld, { recursive: true, force: true }).catch(() => {});
  } catch (e) {
    // Roll back.
    await fsp.rm(world, { recursive: true, force: true }).catch(() => {});
    if (fs.existsSync(backupOld)) await fsp.rename(backupOld, world);
    throw e;
  } finally {
    if (row.gdrive_file_id) await fsp.unlink(localZip).catch(() => {});
  }

  if (wasRunning) {
    await startServer();
  }
}

export async function removeBackup(id: number): Promise<void> {
  const row = getBackup(id);
  if (!row) return;
  if (row.gdrive_file_id) {
    await gdrive.deleteFile(row.gdrive_file_id).catch(() => {});
  } else {
    await fsp
      .unlink(path.join(tmpDir(), row.filename))
      .catch(() => {});
  }
  deleteBackup(id);
}

export function backupLink(row: BackupRow): string | null {
  return row.gdrive_file_id ? gdrive.driveLink(row.gdrive_file_id) : null;
}
