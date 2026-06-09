import { NextRequest, NextResponse } from "next/server";
import { rconCommand } from "@/lib/rcon";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { command } = await req.json().catch(() => ({ command: "" }));
  if (!command || typeof command !== "string") {
    return NextResponse.json({ error: "command required" }, { status: 400 });
  }
  try {
    const output = await rconCommand(command.replace(/^\//, ""));
    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "RCON command failed" },
      { status: 500 }
    );
  }
}
