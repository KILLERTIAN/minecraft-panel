// Username <-> UUID via Mojang API. Cached in memory (process lifetime).

const nameToUuid = new Map<string, string>();
const uuidToName = new Map<string, string>();

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
