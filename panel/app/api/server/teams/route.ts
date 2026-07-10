import { NextRequest, NextResponse } from "next/server";
import {
  listTeams,
  createTeam,
  removeTeam,
  setTeamFriendlyFire,
  addToTeam,
} from "@/lib/rcon";
import { getStatus } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: list scoreboard teams (used for the live friendly-fire controls).
export async function GET() {
  const status = await getStatus();
  if (!status.running) {
    return NextResponse.json({ teams: [], running: false });
  }
  try {
    const teams = await listTeams();
    return NextResponse.json({ teams, running: true });
  } catch (e: any) {
    return NextResponse.json(
      { teams: [], running: true, error: e?.message || "RCON unavailable" },
      { status: 503 }
    );
  }
}

// Team and player names are interpolated into RCON commands, so restrict them
// to the safe identifier charset to prevent argument/selector injection.
const SAFE_NAME = /^[A-Za-z0-9_]{1,40}$/;

// POST: mutate teams. Body: { action, team, player?, on? }
export async function POST(req: NextRequest) {
  const { action, team, player, on } = await req.json().catch(() => ({}));

  const status = await getStatus();
  if (!status.running) {
    return NextResponse.json({ error: "server offline" }, { status: 409 });
  }
  if (!team || typeof team !== "string" || !SAFE_NAME.test(team)) {
    return NextResponse.json({ error: "invalid team name" }, { status: 400 });
  }
  if (player != null && (typeof player !== "string" || !SAFE_NAME.test(player))) {
    return NextResponse.json({ error: "invalid player name" }, { status: 400 });
  }

  try {
    let output: string;
    switch (action) {
      case "friendlyFire":
        output = await setTeamFriendlyFire(team, Boolean(on));
        break;
      case "create":
        output = await createTeam(team);
        break;
      case "remove":
        output = await removeTeam(team);
        break;
      case "join":
        if (!player) return NextResponse.json({ error: "player required" }, { status: 400 });
        output = await addToTeam(team, player);
        break;
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, output });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "RCON command failed" }, { status: 500 });
  }
}
