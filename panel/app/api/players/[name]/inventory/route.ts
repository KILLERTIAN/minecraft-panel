import { NextRequest, NextResponse } from "next/server";
import { readPlayerData } from "@/lib/nbt-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// `name` segment is actually the UUID here (players page passes uuid).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: uuid } = await params;
  const data = await readPlayerData(uuid);
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
  });
}
