import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROPS_PATH = () => path.join(config.mcDataPath, "server.properties");

const EDITABLE_KEYS = new Set([
  "motd",
  "max-players",
  "difficulty",
  "gamemode",
  "hardcore",
  "pvp",
  "allow-flight",
  "allow-nether",
  "enable-command-block",
  "force-gamemode",
  "online-mode",
  "player-idle-timeout",
  "spawn-protection",
  "view-distance",
  "simulation-distance",
  "max-world-size",
  "level-seed",
  "spawn-animals",
  "spawn-monsters",
  "spawn-npcs",
  "generate-structures",
  "white-list",
  "enforce-whitelist",
]);

async function parseProps(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(PROPS_PATH(), "utf8");
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      result[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
    }
    return result;
  } catch {
    return {};
  }
}

async function writeProps(props: Record<string, string>): Promise<void> {
  const lines = ["#Minecraft server properties", `#${new Date().toUTCString()}`];
  for (const [k, v] of Object.entries(props)) {
    lines.push(`${k}=${v}`);
  }
  await fs.writeFile(PROPS_PATH(), lines.join("\n") + "\n", "utf8");
}

export async function GET() {
  const all = await parseProps();
  const editable: Record<string, string> = {};
  for (const k of EDITABLE_KEYS) {
    if (k in all) editable[k] = all[k];
  }
  return NextResponse.json({ properties: editable, all });
}

export async function POST(req: NextRequest) {
  const { properties } = await req.json().catch(() => ({ properties: {} }));
  if (!properties || typeof properties !== "object") {
    return NextResponse.json({ error: "properties object required" }, { status: 400 });
  }
  const current = await parseProps();
  for (const [k, v] of Object.entries(properties)) {
    if (EDITABLE_KEYS.has(k)) {
      current[k] = String(v);
    }
  }
  await writeProps(current);
  return NextResponse.json({ ok: true });
}
