import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/rcon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await listPlayers();
    return NextResponse.json(players);
  } catch (e: any) {
    // listPlayers throws only when BOTH TCP RCON and the docker-exec fallback
    // fail (server offline/unreachable). Surface it instead of silently
    // reporting zero players, which hides the real failure on the dashboard.
    console.warn(`[api/players/list] ${e?.message || e}`);
    return NextResponse.json(
      { online: 0, max: 0, names: [], error: e?.message || "RCON unavailable" },
      { status: 503 }
    );
  }
}
