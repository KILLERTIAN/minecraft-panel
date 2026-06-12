import { NextRequest, NextResponse } from "next/server";
import { promises as fsp } from "fs";
import fs from "fs";
import path from "path";
import { config } from "@/lib/config";
import { getStatus, stopServer, startServer } from "@/lib/docker";
import { resolveWorldDir, invalidateWorldDirCache } from "@/lib/nbt-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function worldPath(): string {
  return resolveWorldDir();
}

async function setSeedInProperties(seed: string): Promise<void> {
  const propsPath = path.join(config.mcDataPath, "server.properties");
  try {
    let raw = await fsp.readFile(propsPath, "utf8");
    if (raw.match(/^level-seed=.*/m)) {
      raw = raw.replace(/^level-seed=.*/m, `level-seed=${seed}`);
    } else {
      raw += `\nlevel-seed=${seed}`;
    }
    await fsp.writeFile(propsPath, raw, "utf8");
  } catch {
    // server.properties may not exist yet on fresh installs; ignore
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const seed: string = typeof body.seed === "string" ? body.seed.trim() : "";

  const status = await getStatus();
  const wasRunning = status.running;

  if (wasRunning) {
    await stopServer();
    await new Promise((r) => setTimeout(r, 4000));
  }

  const world = worldPath();

  // Move current world aside (safety copy, not silent delete)
  if (fs.existsSync(world)) {
    const backup = `${world}.pre-reset-${Date.now()}`;
    await fsp.rename(world, backup);
  }

  // Write seed to server.properties (empty = random)
  await setSeedInProperties(seed);
  invalidateWorldDirCache();

  if (wasRunning) {
    await startServer();
  }

  return NextResponse.json({ ok: true, seed: seed || "random", restarted: wasRunning });
}
