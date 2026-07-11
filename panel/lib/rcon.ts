import { Rcon } from "rcon-client";
import { config } from "./config";

// Lazy, reused RCON connection. Reconnects automatically when the socket drops
// (e.g. server restart).
let conn: Rcon | null = null;
let connecting: Promise<Rcon> | null = null;

async function connect(): Promise<Rcon> {
  if (conn) return conn;
  if (connecting) return connecting;

  connecting = (async () => {
    const rcon = await Rcon.connect({
      host: config.rconHost,
      port: config.rconPort,
      password: config.rconPassword,
    });
    rcon.on("end", () => {
      if (conn === rcon) conn = null;
    });
    rcon.on("error", () => {
      if (conn === rcon) conn = null;
    });
    conn = rcon;
    connecting = null;
    return rcon;
  })();

  try {
    return await connecting;
  } catch (e) {
    connecting = null;
    throw e;
  }
}

export async function rconCommand(cmd: string): Promise<string> {
  const rcon = await connect();
  try {
    return await rcon.send(cmd);
  } catch (e) {
    // Drop dead connection so next call reconnects.
    conn = null;
    throw e;
  }
}

// Like rconCommand but falls back to `rcon-cli` inside the mc container via
// docker exec when the panel's TCP RCON connection fails (DNS, restart, port).
// Use for mutating commands (difficulty, team, etc.) that must not silently
// no-op just because the TCP path is flaky.
export async function rconCommandSafe(cmd: string): Promise<string> {
  try {
    return await rconCommand(cmd);
  } catch (rconErr: any) {
    const { execInMc } = await import("./docker");
    try {
      return await execInMc(["rcon-cli", cmd]);
    } catch (execErr: any) {
      throw new Error(
        `rcon failed: tcp=${rconErr?.message || rconErr}; exec=${execErr?.message || execErr}`
      );
    }
  }
}

export async function isRconReachable(): Promise<boolean> {
  try {
    await connect();
    return true;
  } catch {
    return false;
  }
}

// --- Parsed helpers ---

export interface OnlinePlayers {
  online: number;
  max: number;
  names: string[];
}

// Parse the text output of the Minecraft "list" command.
// Vanilla: "There are 2 of a max of 20 players online: Alice, Bob"
// Some versions/forks vary wording ("out of max", "max players", color codes,
// trailing punctuation). Parse defensively. Returns null when nothing usable is
// found so callers can distinguish "0 players" from "unparseable".
export function parseListOutput(raw: string): OnlinePlayers | null {
  // Strip Minecraft section-sign color codes (§a etc.) just in case.
  const res = raw.replace(/§[0-9a-fk-or]/gi, "");

  // Tolerant: "There are N of a max of M players online" and variants like
  // "There are N/M players online" or "max M".
  const m = res.match(
    /There are (\d+) (?:of a max of|out of(?: max(?:imum)?)?|\/)\s*(\d+)[^:]*:?\s*(.*)/i
  );
  if (m) {
    const names = m[3]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return { online: parseInt(m[1], 10), max: parseInt(m[2], 10), names };
  }

  // Fallback: pull "N ... M" numbers, but only from output that actually looks
  // like a player list. Without this guard, error text (e.g. rcon-cli printing
  // "2026/07/11 10:32 Failed to connect to RCON server dial tcp ...") gets
  // mis-parsed into a bogus count like 2026/7.
  if (/players?\s+online/i.test(res)) {
    const nums = res.match(/(\d+)\D+(\d+)/);
    if (nums) {
      const after = res.split(":").slice(1).join(":");
      const names = after
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return { online: parseInt(nums[1], 10), max: parseInt(nums[2], 10), names };
    }
  }
  return null;
}

// Get online players. Tries TCP RCON first; on failure (DNS, restart, port)
// falls back to running `rcon-cli list` inside the mc container via docker exec,
// which uses the container's own loopback. Throws if BOTH paths fail so callers
// (idle shutdown, dashboard) can tell "RCON down" from "0 players online".
export async function listPlayers(): Promise<OnlinePlayers> {
  let raw: string;
  try {
    raw = await rconCommand("list");
  } catch (rconErr: any) {
    // Lazy import to avoid a cycle (docker.ts doesn't import rcon.ts, but keep
    // the dependency direction one-way and obvious).
    const { execInMc } = await import("./docker");
    try {
      raw = await execInMc(["rcon-cli", "list"]);
    } catch (execErr: any) {
      throw new Error(
        `listPlayers failed: rcon=${rconErr?.message || rconErr}; exec=${execErr?.message || execErr}`
      );
    }
  }

  // rcon-cli exits 0 even when it can't reach the server, printing the failure
  // to stdout. Treat that as RCON-down (throw) rather than "0 players".
  if (/failed to connect|connection refused|dial tcp/i.test(raw)) {
    throw new Error(`listPlayers failed: rcon-cli could not reach server: ${raw.trim()}`);
  }

  const parsed = parseListOutput(raw);
  if (!parsed) {
    console.warn(`[rcon] listPlayers: unrecognized 'list' output: ${JSON.stringify(raw)}`);
    return { online: 0, max: 0, names: [] };
  }
  return parsed;
}

export async function whitelistAdd(name: string): Promise<string> {
  return rconCommand(`whitelist add ${name}`);
}

export async function whitelistRemove(name: string): Promise<string> {
  return rconCommand(`whitelist remove ${name}`);
}

export async function whitelistReload(): Promise<string> {
  return rconCommand("whitelist reload");
}

// Live position for an online player (playerdata files lag behind autosave).
// "Alice has the following entity data: [43.06d, 68.0d, 3.57d]"
export async function getLivePosition(
  name: string
): Promise<{ x: number; y: number; z: number; dimension: string } | null> {
  const posRes = await rconCommand(`data get entity ${name} Pos`);
  const m = posRes.match(/\[(-?[\d.]+)d?,\s*(-?[\d.]+)d?,\s*(-?[\d.]+)d?\]/);
  if (!m) return null;
  let dimension = "minecraft:overworld";
  try {
    const dimRes = await rconCommand(`data get entity ${name} Dimension`);
    const dm = dimRes.match(/"([\w:]+)"/);
    if (dm) dimension = dm[1];
  } catch {}
  return {
    x: Math.round(parseFloat(m[1])),
    y: Math.round(parseFloat(m[2])),
    z: Math.round(parseFloat(m[3])),
    dimension,
  };
}

export async function saveOff(): Promise<void> {
  await rconCommand("save-off");
  await rconCommand("save-all flush");
}

export async function saveOn(): Promise<void> {
  await rconCommand("save-on");
}

// --- Scoreboard teams (live friendly-fire control) ---
//
// Vanilla has no global "pvp" live toggle, but per-team friendly fire IS live:
//   /team modify <team> friendlyFire <bool>
// These use rconCommandSafe so they work even when the TCP RCON path is flaky.

// Parse "/team list" output: "There are N teams: [Alpha], [Beta]" (team names
// render as their display component, wrapped in [Name]). "There are no teams"
// yields an empty list.
export function parseTeamList(raw: string): string[] {
  const res = raw.replace(/§[0-9a-fk-or]/gi, "");
  if (/no teams/i.test(res)) return [];
  const names = new Set<string>();
  // Names appear as bracketed tokens: [red], [Alpha] ...
  for (const m of res.matchAll(/\[([^\]]+)\]/g)) {
    const n = m[1].trim();
    if (n) names.add(n);
  }
  return Array.from(names);
}

export async function listTeams(): Promise<string[]> {
  const raw = await rconCommandSafe("team list");
  return parseTeamList(raw);
}

export async function setTeamFriendlyFire(team: string, on: boolean): Promise<string> {
  return rconCommandSafe(`team modify ${team} friendlyFire ${on ? "true" : "false"}`);
}

export async function createTeam(team: string): Promise<string> {
  return rconCommandSafe(`team add ${team}`);
}

export async function removeTeam(team: string): Promise<string> {
  return rconCommandSafe(`team remove ${team}`);
}

export async function addToTeam(team: string, player: string): Promise<string> {
  return rconCommandSafe(`team join ${team} ${player}`);
}
