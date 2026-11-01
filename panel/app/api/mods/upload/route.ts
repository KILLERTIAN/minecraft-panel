import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { config } from "@/lib/config";
import { getStatus, stopServer, startServer } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function modsPath(): string {
  return path.join(config.mcDataPath, "mods");
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

  const file = form.get("mod") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file received — field must be named 'mod'" }, { status: 400 });
  }
  if (!file.name.endsWith(".jar")) {
    return NextResponse.json({ error: "Upload a .jar file (Fabric/Forge mod)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const filePath = path.join(tmpDir(), `mod-${Date.now()}.jar`);
  await fsp.writeFile(filePath, Buffer.from(bytes));

  const status = await getStatus();
  const wasRunning = status.running;

  // Stop server if running to avoid file locks
  if (wasRunning) {
    await stopServer();
    await new Promise((r) => setTimeout(r, 3000));
  }

  const targetPath = path.join(modsPath(), file.name);
  try {
    // Ensure mods directory exists
    fs.mkdirSync(modsPath(), { recursive: true });

    // Move file to mods directory
    await fsp.rename(filePath, targetPath);

    // Set proper permissions (minecraft user typically runs as 1000:1000)
    try {
      execSync(`chown 1000:1000 "${path.resolve(targetPath)}"`, { stdio: "ignore" });
    } catch { /* non-fatal */ }
  } catch (e: any) {
    await fsp.unlink(filePath).catch(() => {});
    return NextResponse.json({ error: `Failed to install mod: ${e?.message}` }, { status: 500 });
  }

  // Restart server if it was running
  if (wasRunning) {
    await startServer();
  }

  return NextResponse.json({ 
    ok: true, 
    filename: file.name,
    restarted: wasRunning 
  });
}