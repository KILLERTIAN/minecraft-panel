import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import extract from "extract-zip";
import { config } from "@/lib/config";
import { getStatus, stopServer, startServer } from "@/lib/docker";
import { resolveWorldDir, invalidateWorldDirCache } from "@/lib/nbt-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function worldPath(): string {
  return resolveWorldDir();
}

// level.dat at the zip root, or inside the first folder that has one.
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

function tmpDir(): string {
  const d = path.join(config.dataDir, "tmp");
  fs.mkdirSync(d, { recursive: true });
  return d;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch (e: any) {
    return NextResponse.json({ error: `Parse failed: ${e?.message}` }, { status: 400 });
  }

  const file = form.get("world") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file received — field must be named 'world'" }, { status: 400 });
  }
  if (!file.name.endsWith(".zip")) {
    return NextResponse.json({ error: "Upload a .zip file containing your world folder" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const zipPath = path.join(tmpDir(), `upload-${Date.now()}.zip`);
  await fsp.writeFile(zipPath, Buffer.from(bytes));

  // Extract to staging first and validate before touching the live world.
  const staging = path.join(tmpDir(), `upload-${Date.now()}`);
  await fsp.mkdir(staging, { recursive: true });
  let extractedWorld: string | null = null;
  try {
    await extract(zipPath, { dir: path.resolve(staging) });
    extractedWorld = await findExtractedWorld(staging);
  } catch (e: any) {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fsp.unlink(zipPath).catch(() => {});
    return NextResponse.json({ error: `Failed to extract world: ${e?.message}` }, { status: 500 });
  }
  if (!extractedWorld) {
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fsp.unlink(zipPath).catch(() => {});
    return NextResponse.json(
      { error: "Zip does not contain a world (no level.dat found)" },
      { status: 400 }
    );
  }

  const status = await getStatus();
  const wasRunning = status.running;

  if (wasRunning) {
    await stopServer();
    await new Promise((r) => setTimeout(r, 3000));
  }

  const world = worldPath();
  const backupOld = `${world}.pre-upload-${Date.now()}`;

  if (fs.existsSync(world)) {
    await fsp.rename(world, backupOld);
  }

  try {
    await fsp.rename(extractedWorld, world);
    try {
      execSync(`chown -R 1000:1000 "${path.resolve(world)}"`, { stdio: "ignore" });
    } catch { /* non-fatal */ }
    await fsp.rm(backupOld, { recursive: true, force: true }).catch(() => {});
  } catch (e: any) {
    await fsp.rm(world, { recursive: true, force: true }).catch(() => {});
    if (fs.existsSync(backupOld)) await fsp.rename(backupOld, world);
    await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
    await fsp.unlink(zipPath).catch(() => {});
    return NextResponse.json({ error: `Failed to install world: ${e?.message}` }, { status: 500 });
  }

  invalidateWorldDirCache();
  await fsp.rm(staging, { recursive: true, force: true }).catch(() => {});
  await fsp.unlink(zipPath).catch(() => {});

  if (wasRunning) {
    await startServer();
  }

  return NextResponse.json({ ok: true, restarted: wasRunning });
}
