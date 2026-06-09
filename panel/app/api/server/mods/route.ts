import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ModInfo {
  filename: string;
  sizeBytes: number;
  enabled: boolean;
}

export async function GET() {
  const modsDir = path.join(config.mcDataPath, "mods");
  try {
    const files = await fs.readdir(modsDir);
    const mods: ModInfo[] = [];
    for (const f of files) {
      if (!f.endsWith(".jar") && !f.endsWith(".jar.disabled")) continue;
      const stat = await fs.stat(path.join(modsDir, f)).catch(() => null);
      mods.push({
        filename: f,
        sizeBytes: stat?.size ?? 0,
        enabled: f.endsWith(".jar"),
      });
    }
    mods.sort((a, b) => a.filename.localeCompare(b.filename));
    return NextResponse.json({ mods });
  } catch {
    return NextResponse.json({ mods: [] });
  }
}
