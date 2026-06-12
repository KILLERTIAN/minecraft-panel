// Username <-> UUID. Tries the server's usercache.json first (works for
// offline-mode servers whose UUIDs don't exist on Mojang), then Mojang API.
// Cached in memory (process lifetime).

import fs from "fs";
import path from "path";
import { config } from "./config";

const nameToUuid = new Map<string, string>();
const uuidToName = new Map<string, string>();

let ucCache: { at: number; byUuid: Map<string, string> } | null = null;
function usercache(): Map<string, string> {
  if (ucCache && Date.now() - ucCache.at < 30_000) return ucCache.byUuid;
  const byUuid = new Map<string, string>();
  try {
    const raw = fs.readFileSync(path.join(config.mcDataPath, "usercache.json"), "utf8");
    for (const e of JSON.parse(raw)) {
      if (e?.uuid && e?.name) {
        byUuid.set(String(e.uuid).replace(/-/g, "").toLowerCase(), e.name);
      }
    }
  } catch {}
  ucCache = { at: Date.now(), byUuid };
  return byUuid;
}

function dashUuid(raw: string): string {
  // 32-char hex -> 8-4-4-4-12
  if (raw.includes("-")) return raw;
  return raw.replace(
    /(.{8})(.{4})(.{4})(.{4})(.{12})/,
    "$1-$2-$3-$4-$5"
  );
}

export async function getUuid(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  if (nameToUuid.has(key)) return nameToUuid.get(key)!;
  try {
    const r = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.id) return null;
    const uuid = dashUuid(d.id);
    nameToUuid.set(key, uuid);
    uuidToName.set(uuid.replace(/-/g, ""), d.name);
    return uuid;
  } catch {
    return null;
  }
}

export async function getName(uuid: string): Promise<string | null> {
  const bare = uuid.replace(/-/g, "");
  if (uuidToName.has(bare)) return uuidToName.get(bare)!;
  const local = usercache().get(bare.toLowerCase());
  if (local) {
    uuidToName.set(bare, local);
    return local;
  }
  try {
    const r = await fetch(
      `https://sessionserver.mojang.com/session/minecraft/profile/${bare}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    if (!d?.name) return null;
    uuidToName.set(bare, d.name);
    return d.name;
  } catch {
    return null;
  }
}

export function avatarUrl(name: string): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/64`;
}
