import { NextResponse } from "next/server";
import { listPlayers } from "@/lib/rcon";
import { listPlayerUuids, readPlayerData } from "@/lib/nbt-reader";
import { getName, avatarUrl } from "@/lib/mojang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns every player who has ever joined (from playerdata files), merged with
// who is currently online (RCON).
export async function GET() {
  const online = await listPlayers().catch(() => ({
    online: 0,
    max: 0,
    names: [] as string[],
  }));
  const onlineSet = new Set(online.names.map((n) => n.toLowerCase()));

  const uuids = await listPlayerUuids();
  const players = await Promise.all(
    uuids.map(async (uuid) => {
      const [data, name] = await Promise.all([
        readPlayerData(uuid),
        getName(uuid),
      ]);
      const displayName = name || uuid.slice(0, 8);
      return {
        uuid,
        name: displayName,
        avatar: name ? avatarUrl(name) : null,
        online: name ? onlineSet.has(name.toLowerCase()) : false,
        health: data?.health ?? null,
        foodLevel: data?.foodLevel ?? null,
        xpLevel: data?.xpLevel ?? null,
        position: data?.position ?? null,
        death: data?.death ?? null,
        inventoryCount: data?.inventory.length ?? 0,
        lastModified: data?.lastModified ?? null,
      };
    })
  );

  // Online first, then most recently seen.
  players.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (b.lastModified || "").localeCompare(a.lastModified || "");
  });

  return NextResponse.json({ players, onlineNames: online.names });
}
