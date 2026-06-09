import { promises as fs } from "fs";
import path from "path";
import * as nbt from "prismarine-nbt";
import { config } from "./config";

function worldDir(): string {
  return path.join(config.mcDataPath, config.worldName);
}

export interface InvItem {
  slot: number;
  id: string; // e.g. minecraft:diamond_sword
  count: number;
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

function mapItems(arr: any[] | undefined): InvItem[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((it) => ({
    slot: typeof it.Slot === "number" ? it.Slot : -1,
    id: it.id || "minecraft:unknown",
    count: it.count ?? it.Count ?? 1,
  }));
}

export async function listPlayerUuids(): Promise<string[]> {
  try {
    const dir = path.join(worldDir(), "playerdata");
    const files = await fs.readdir(dir);
    return files
      .filter((f) => f.endsWith(".dat") && !f.endsWith(".dat_old"))
      .map((f) => f.replace(/\.dat$/, ""));
  } catch {
    return [];
  }
}

export async function readPlayerData(uuid: string): Promise<PlayerData | null> {
  const file = path.join(worldDir(), "playerdata", `${uuid}.dat`);
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
    name: config.worldName,
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
