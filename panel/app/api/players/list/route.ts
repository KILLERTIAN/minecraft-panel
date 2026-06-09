import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/rcon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await listPlayers();
    return NextResponse.json(players);
  } catch {
    // Server likely offline -> empty.
    return NextResponse.json({ online: 0, max: 0, names: [] });
  }
}
