import { NextRequest, NextResponse } from "next/server";
import { rconCommand } from "@/lib/rcon";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const { action, reason, duration } = await req.json().catch(() => ({}));

  let cmd: string;
  switch (action) {
    case "kick":
      cmd = `kick ${name}${reason ? " " + reason : ""}`;
      break;
    case "ban":
      cmd = `ban ${name}${reason ? " " + reason : ""}`;
      break;
    case "pardon":
      cmd = `pardon ${name}`;
      break;
    case "op":
      cmd = `op ${name}`;
      break;
    case "deop":
      cmd = `deop ${name}`;
      break;
    case "gamemode":
      cmd = `gamemode ${reason} ${name}`;
      break;
    case "teleport":
      cmd = `tp ${name} ${reason}`;
      break;
    case "give":
      cmd = `give ${name} ${reason}${duration ? " " + duration : ""}`;
      break;
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  try {
    const output = await rconCommand(cmd);
    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "RCON command failed" },
      { status: 500 }
    );
  }
}
