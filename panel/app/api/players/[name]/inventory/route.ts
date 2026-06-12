import { NextRequest, NextResponse } from "next/server";
import { readPlayerData, PlayerData } from "@/lib/nbt-reader";
import { getPlayerSnapshot } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `name` segment is actually the UUID here (players page passes uuid).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: uuid } = await params;

  // Live .dat file first; stored DB snapshot if the file is gone.
  let data = await readPlayerData(uuid);
  let stored = false;
  if (!data) {
    const snap = getPlayerSnapshot(uuid);
    if (snap?.data_json) {
      try {
        data = JSON.parse(snap.data_json) as PlayerData;
        stored = true;
      } catch {}
    }
  }
  if (!data) {
    return NextResponse.json({ error: "no player data" }, { status: 404 });
  }
  return NextResponse.json({
    inventory: data.inventory,
    enderItems: data.enderItems,
    health: data.health,
    foodLevel: data.foodLevel,
    xpLevel: data.xpLevel,
    death: data.death,
    stored,
  });
}
