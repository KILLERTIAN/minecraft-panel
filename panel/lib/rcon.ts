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

// Vanilla "list" output: "There are 2 of a max of 20 players online: Alice, Bob"
export async function listPlayers(): Promise<OnlinePlayers> {
  const res = await rconCommand("list");
  const m = res.match(/There are (\d+) of a max of (\d+) players online:?\s*(.*)/i);
  if (!m) return { online: 0, max: 0, names: [] };
  const names = m[3]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { online: parseInt(m[1], 10), max: parseInt(m[2], 10), names };
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

export async function saveOff(): Promise<void> {
  await rconCommand("save-off");
  await rconCommand("save-all flush");
}

export async function saveOn(): Promise<void> {
  await rconCommand("save-on");
}
