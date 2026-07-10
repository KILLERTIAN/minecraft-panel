import { NextRequest, NextResponse } from "next/server";
import { rconCommandSafe } from "@/lib/rcon";
import { getStatus } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Properties that can be applied live via RCON without restart.
// NOTE: vanilla/Fabric has NO `/pvp` command — the `pvp` server property is
// only read at server start, so it is intentionally NOT here (restart-only).
const LIVE_APPLY: Record<string, (val: string) => string[]> = {
  gamemode: (v) => [`defaultgamemode ${v}`],
  difficulty: (v) => [`difficulty ${v}`],
  "max-players": (v) => [`setmaxplayers ${v}`],
  "white-list": (v) => [`whitelist ${v === "true" ? "on" : "off"}`],
  "enforce-whitelist": (v) => [`whitelist reload`],
  "spawn-protection": (v) => [], // no live command, needs restart
  "view-distance": (v) => [], // no vanilla live command
};

export async function POST(req: NextRequest) {
  const { properties } = await req.json().catch(() => ({ properties: {} }));
  if (!properties || typeof properties !== "object") {
    return NextResponse.json({ error: "properties object required" }, { status: 400 });
  }

  const status = await getStatus();
  if (!status.running) {
    return NextResponse.json({ ok: true, applied: [], skipped: Object.keys(properties), reason: "server offline" });
  }

  const applied: string[] = [];
  const skipped: string[] = [];
  const errors: Record<string, string> = {};

  for (const [key, val] of Object.entries(properties)) {
    const cmdFn = LIVE_APPLY[key];
    if (!cmdFn) { skipped.push(key); continue; }
    const cmds = cmdFn(val as string);
    if (cmds.length === 0) { skipped.push(key); continue; }
    for (const cmd of cmds) {
      try {
        await rconCommandSafe(cmd);
        applied.push(key);
      } catch (e: any) {
        errors[key] = e?.message || "rcon error";
        skipped.push(key);
      }
    }
  }

  return NextResponse.json({ ok: true, applied, skipped, errors });
}
