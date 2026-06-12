import { NextResponse } from "next/server";
import { listPlayers, getLivePosition } from "@/lib/rcon";
import {
  listPlayerUuids,
  readPlayerData,
  readPlayerStats,
  PlayerData,
} from "@/lib/nbt-reader";
import { getName, avatarUrl } from "@/lib/mojang";
import { listPlayerSnapshots, upsertPlayerSnapshot } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Returns every player known to the panel: playerdata files on disk, plus
// snapshots stored in the DB (so history survives world resets), merged with
// who is currently online (RCON). Fresh reads are persisted back to the DB.
export async function GET() {
  const online = await listPlayers().catch(() => ({
    online: 0,
    max: 0,
    names: [] as string[],
  }));
  const onlineSet = new Set(online.names.map((n) => n.toLowerCase()));

  const fileUuids = await listPlayerUuids();
  const snapshots = new Map(listPlayerSnapshots().map((s) => [s.uuid, s]));
  const uuids = Array.from(new Set([...fileUuids, ...snapshots.keys()]));

  const players = await Promise.all(
    uuids.map(async (uuid) => {
      const snap = snapshots.get(uuid);

      // Live .dat file wins; stored snapshot fills in when the file is gone
      // (e.g. world was reset) or unreadable.
      let data = await readPlayerData(uuid);
      let fromSnapshot = false;
      if (!data && snap?.data_json) {
        try {
          data = JSON.parse(snap.data_json) as PlayerData;
          fromSnapshot = true;
        } catch {}
      }

      const stats = await readPlayerStats(uuid);
      const name = (await getName(uuid)) || snap?.name || null;
      const displayName = name || uuid.slice(0, 8);
      const isOnline = name ? onlineSet.has(name.toLowerCase()) : false;

      // Online players: ask the server for the live position, since playerdata
      // files only update on autosave/logout.
      let position = data?.position ?? null;
      if (isOnline && name) {
        const live = await getLivePosition(name).catch(() => null);
        if (live) position = live;
      }

      // Persist what we know. Snapshot-sourced data isn't written back to
      // avoid overwriting updated_at with stale content.
      upsertPlayerSnapshot({
        uuid,
        name,
        online: isOnline,
        dataJson: data && !fromSnapshot ? JSON.stringify(data) : null,
      });

      const lastSeen = isOnline
        ? new Date().toISOString()
        : snap?.last_online || data?.lastModified || null;

      return {
        uuid,
        name: displayName,
        avatar: name ? avatarUrl(name) : null,
        online: isOnline,
        health: data?.health ?? null,
        foodLevel: data?.foodLevel ?? null,
        xpLevel: data?.xpLevel ?? null,
        position,
        death: data?.death ?? null,
        inventoryCount: data?.inventory.length ?? 0,
        lastModified: lastSeen,
        stored: fromSnapshot,
        stats,
      };
    })
  );

  // RCON may report players the panel has no data for yet (playerdata flushes
  // on autosave). Show them anyway so "online" never undercounts.
  const knownNames = new Set(players.map((p) => p.name.toLowerCase()));
  for (const n of online.names) {
    if (knownNames.has(n.toLowerCase())) continue;
    const live = await getLivePosition(n).catch(() => null);
    players.push({
      uuid: `online:${n}`,
      name: n,
      avatar: avatarUrl(n),
      online: true,
      health: null,
      foodLevel: null,
      xpLevel: null,
      position: live,
      death: null,
      inventoryCount: 0,
      lastModified: new Date().toISOString(),
      stored: false,
      stats: null,
    });
  }

  // Online first, then most recently seen.
  players.sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (b.lastModified || "").localeCompare(a.lastModified || "");
  });

  return NextResponse.json({ players, onlineNames: online.names });
}
