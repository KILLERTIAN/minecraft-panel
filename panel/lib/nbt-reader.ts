import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import * as nbt from "prismarine-nbt";
import { config } from "./config";

// The active world folder is whatever server.properties `level-name` points at,
// which may differ from the WORLD_NAME env. Resolve it by checking for level.dat,
// falling back to a directory scan. Cached briefly since it rarely changes.
let cachedWorldDir: { dir: string; at: number } | null = null;

export function resolveWorldDir(): string {
  if (cachedWorldDir && Date.now() - cachedWorldDir.at < 30_000) {
    return cachedWorldDir.dir;
  }
  const base = config.mcDataPath;
  const candidates: string[] = [];
  try {
    const raw = fsSync.readFileSync(path.join(base, "server.properties"), "utf8");
    const m = raw.match(/^level-name=(.*)$/m);
    if (m && m[1].trim()) candidates.push(m[1].trim());
  } catch {}
  candidates.push(config.worldName, "world");

  for (const c of candidates) {
    const dir = path.join(base, c);
    if (fsSync.existsSync(path.join(dir, "level.dat"))) {
      cachedWorldDir = { dir, at: Date.now() };
      return dir;
    }
  }
  // Last resort: any directory under mcDataPath holding a level.dat.
  try {
    for (const e of fsSync.readdirSync(base, { withFileTypes: true })) {
      if (e.isDirectory() && fsSync.existsSync(path.join(base, e.name, "level.dat"))) {
        const dir = path.join(base, e.name);
        cachedWorldDir = { dir, at: Date.now() };
        return dir;
      }
    }
  } catch {}
  // Nothing found; return the configured path and let callers report it missing.
  return path.join(base, config.worldName);
}

export function invalidateWorldDirCache(): void {
  cachedWorldDir = null;
}

function worldDir(): string {
  return resolveWorldDir();
}

// Per-player data moved in MC 1.21.9 (snapshot 26.x): the top-level
// world/playerdata, world/stats, world/advancements folders are now nested
// under world/players/{data,stats,advancements}. Resolve each by preferring the
// new layout, falling back to the legacy path so older servers still work.
function playerSubDir(kind: "data" | "stats" | "advancements"): string {
  const w = worldDir();
  const legacy = kind === "data" ? "playerdata" : kind; // stats/advancements keep their name
  const nested = path.join(w, "players", kind);
  if (fsSync.existsSync(nested)) return nested;
  const flat = path.join(w, legacy);
  if (fsSync.existsSync(flat)) return flat;
  // Neither exists yet (fresh world): default to the new layout.
  return nested;
}

export interface Enchant {
  id: string; // e.g. minecraft:unbreaking
  lvl: number;
}

export interface InvItem {
  slot: number;
  id: string; // e.g. minecraft:diamond_sword
  count: number;
  name: string | null; // custom display name, if renamed
  enchants: Enchant[];
  damage: number | null; // durability used
  maxDamage: number | null; // from component, if present
  potion: string | null; // e.g. minecraft:swiftness
}

export interface DeathLocation {
  x: number;
  y: number;
  z: number;
  dimension: string;
}

export interface PlayerData {
  uuid: string;
  inventory: InvItem[];
  enderItems: InvItem[];
  health: number | null;
  foodLevel: number | null;
  xpLevel: number | null;
  position: { x: number; y: number; z: number; dimension: string } | null;
  death: DeathLocation | null;
  lastModified: string | null;
}

// prismarine-nbt wraps values as { type, value }. Unwrap to plain JS.
function simplify(node: any): any {
  return nbt.simplify(node);
}

async function parseDat(file: string): Promise<any> {
  const buf = await fs.readFile(file);
  const { parsed } = await nbt.parse(buf);
  return simplify(parsed);
}

// Enchantments appear as a legacy list [{id, lvl}] (pre-1.20.5 `tag`), as
// { levels: { "minecraft:x": n } } (1.20.5–1.21.4 components), or as a plain
// { "minecraft:x": n } map (1.21.5+).
function parseEnchants(raw: any): Enchant[] {
  const out: Enchant[] = [];
  if (!raw) return out;
  if (Array.isArray(raw)) {
    for (const e of raw) {
      if (e?.id) out.push({ id: String(e.id), lvl: Number(e.lvl ?? e.level ?? 1) });
    }
    return out;
  }
  if (typeof raw !== "object") return out;
  const levels = raw.levels && typeof raw.levels === "object" ? raw.levels : raw;
  for (const [k, v] of Object.entries(levels)) {
    if (typeof v === "number") out.push({ id: k, lvl: v });
  }
  return out;
}

// Custom names are JSON text components ('"Excalibur"' / '{"text":"..."}')
// or plain strings/objects in newer formats.
function parseName(raw: any): string | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw.text || null;
  if (typeof raw !== "string") return null;
  try {
    const j = JSON.parse(raw);
    if (typeof j === "string") return j;
    if (Array.isArray(j)) return j.map((p: any) => (typeof p === "string" ? p : p?.text || "")).join("");
    if (j?.text) return j.text;
  } catch {}
  return raw;
}

function mapItems(arr: any[] | undefined): InvItem[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => {
    const comp = it.components || {};
    const tag = it.tag || {};
    const enchants = [
      ...parseEnchants(comp["minecraft:enchantments"]),
      ...parseEnchants(comp["minecraft:stored_enchantments"]),
      ...parseEnchants(tag.Enchantments),
      ...parseEnchants(tag.StoredEnchantments),
    ];
    const name =
      parseName(comp["minecraft:custom_name"]) ?? parseName(tag.display?.Name);
    const damage =
      typeof comp["minecraft:damage"] === "number"
        ? comp["minecraft:damage"]
        : typeof tag.Damage === "number"
          ? tag.Damage
          : null;
    const maxDamage =
      typeof comp["minecraft:max_damage"] === "number" ? comp["minecraft:max_damage"] : null;
    const potionRaw = comp["minecraft:potion_contents"];
    const potion =
      typeof potionRaw === "string"
        ? potionRaw
        : potionRaw?.potion ?? (typeof tag.Potion === "string" ? tag.Potion : null);

    return {
      slot: typeof it.Slot === "number" ? it.Slot : -1,
      id: it.id || "minecraft:unknown",
      count: it.count ?? it.Count ?? 1,
      name,
      enchants,
      damage,
      maxDamage,
      potion,
    };
  });
}

export async function listPlayerUuids(): Promise<string[]> {
  try {
    const dir = playerSubDir("data");
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".dat") && !f.endsWith(".dat_old"))
      .map((f) => f.replace(/\.dat$/, ""));
  } catch {
    return [];
  }
}

export async function readPlayerData(uuid: string): Promise<PlayerData | null> {
  const file = path.join(playerSubDir("data"), `${uuid}.dat`);
  try {
    const stat = await fs.stat(file);
    const d = await parseDat(file);

    // Death location (1.19+: LastDeathLocation { pos:[x,y,z], dimension })
    let death: DeathLocation | null = null;
    if (d.LastDeathLocation?.pos) {
      const p = d.LastDeathLocation.pos;
      death = {
        x: p[0],
        y: p[1],
        z: p[2],
        dimension: d.LastDeathLocation.dimension || "minecraft:overworld",
      };
    }

    // Current position
    let position = null;
    if (Array.isArray(d.Pos)) {
      position = {
        x: Math.round(d.Pos[0]),
        y: Math.round(d.Pos[1]),
        z: Math.round(d.Pos[2]),
        dimension: d.Dimension || "minecraft:overworld",
      };
    }

    return {
      uuid,
      inventory: mapItems(d.Inventory),
      enderItems: mapItems(d.EnderItems),
      health: typeof d.Health === "number" ? Math.round(d.Health) : null,
      foodLevel: typeof d.foodLevel === "number" ? d.foodLevel : null,
      xpLevel: typeof d.XpLevel === "number" ? d.XpLevel : null,
      position,
      death,
      lastModified: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export interface PlayerStats {
  playTimeTicks: number | null;
  deaths: number;
  mobKills: number;
  playerKills: number;
  damageDealt: number;
  damageTaken: number;
}

// Server-maintained stats live in world/stats/<uuid>.json — no external API
// needed. play_time is in ticks (20/s); pre-1.17 the key was play_one_minute.
export async function readPlayerStats(uuid: string): Promise<PlayerStats | null> {
  try {
    const raw = await fs.readFile(
      path.join(playerSubDir("stats"), `${uuid}.json`),
      "utf8"
    );
    const custom = JSON.parse(raw)?.stats?.["minecraft:custom"] || {};
    return {
      playTimeTicks:
        custom["minecraft:play_time"] ?? custom["minecraft:play_one_minute"] ?? null,
      deaths: custom["minecraft:deaths"] ?? 0,
      mobKills: custom["minecraft:mob_kills"] ?? 0,
      playerKills: custom["minecraft:player_kills"] ?? 0,
      damageDealt: custom["minecraft:damage_dealt"] ?? 0,
      damageTaken: custom["minecraft:damage_taken"] ?? 0,
    };
  } catch {
    return null;
  }
}

export interface WorldInfo {
  name: string;
  seed: string | null;
  gameTime: number | null;
  dayTime: number | null;
  difficulty: number | null;
  version: string | null;
  sizeBytes: number | null;
}

export async function readWorldInfo(): Promise<WorldInfo> {
  const base: WorldInfo = {
    name: path.basename(worldDir()),
    seed: null,
    gameTime: null,
    dayTime: null,
    difficulty: null,
    version: null,
    sizeBytes: null,
  };
  try {
    const d = await parseDat(path.join(worldDir(), "level.dat"));
    const data = d.Data || d;
    base.name = data.LevelName || base.name;
    const seed = data.WorldGenSettings?.seed ?? data.RandomSeed;
    base.seed = seed != null ? String(seed) : null;
    base.gameTime = typeof data.Time === "number" ? data.Time : null;
    base.dayTime = typeof data.DayTime === "number" ? data.DayTime : null;
    base.difficulty = typeof data.Difficulty === "number" ? data.Difficulty : null;
    base.version = data.Version?.Name || null;
  } catch {
    /* level.dat may not exist before first run */
  }
  base.sizeBytes = await dirSize(worldDir()).catch(() => null);
  return base;
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) total += await dirSize(full);
    else {
      const s = await fs.stat(full).catch(() => null);
      if (s) total += s.size;
    }
  }
  return total;
}

export { worldDir };
