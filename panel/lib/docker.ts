import Docker from "dockerode";
import { config } from "./config";

// Single Docker client over the mounted socket. Talks only to the mc container.
const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export type ServerState = "online" | "offline" | "starting" | "unknown";

function mc() {
  return docker.getContainer(config.mcContainer);
}

export interface ServerStatus {
  state: ServerState;
  running: boolean;
  health: string | null; // healthy | starting | unhealthy | null
  startedAt: string | null;
  uptimeSeconds: number | null;
  memUsageMB: number | null;
  memLimitMB: number | null;
  cpuPercent: number | null;
}

export async function getStatus(): Promise<ServerStatus> {
  try {
    const info = await mc().inspect();
    const running = info.State.Running === true;
    const health = info.State.Health?.Status ?? null;

    let state: ServerState = running ? "online" : "offline";
    // itzg health: "starting" while MC boots even though container runs.
    if (running && health === "starting") state = "starting";
    if (running && health === "unhealthy") state = "starting";

    const startedAt = running ? info.State.StartedAt : null;
    const uptimeSeconds = startedAt
      ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
      : null;

    let memUsageMB: number | null = null;
    let memLimitMB: number | null = null;
    let cpuPercent: number | null = null;

    if (running) {
      try {
        const stats = await mc().stats({ stream: false });
        memUsageMB = stats.memory_stats?.usage
          ? Math.round(stats.memory_stats.usage / 1024 / 1024)
          : null;
        memLimitMB = stats.memory_stats?.limit
          ? Math.round(stats.memory_stats.limit / 1024 / 1024)
          : null;
        cpuPercent = computeCpu(stats);
      } catch {
        /* stats can fail transiently; ignore */
      }
    }

    return {
      state,
      running,
      health,
      startedAt,
      uptimeSeconds,
      memUsageMB,
      memLimitMB,
      cpuPercent,
    };
  } catch (err: any) {
    // 404 = container does not exist yet (compose not up).
    if (err?.statusCode === 404) {
      return blank("offline");
    }
    return blank("unknown");
  }
}

function blank(state: ServerState): ServerStatus {
  return {
    state,
    running: false,
    health: null,
    startedAt: null,
    uptimeSeconds: null,
    memUsageMB: null,
    memLimitMB: null,
    cpuPercent: null,
  };
}

function computeCpu(stats: any): number | null {
  try {
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const sysDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cores =
      stats.cpu_stats.online_cpus ||
      stats.cpu_stats.cpu_usage.percpu_usage?.length ||
      1;
    if (sysDelta > 0 && cpuDelta > 0) {
      return Math.round((cpuDelta / sysDelta) * cores * 100 * 10) / 10;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function startServer(): Promise<void> {
  await mc().start();
}

export async function stopServer(): Promise<void> {
  // Give MC up to 60s to flush + save before SIGKILL.
  await mc().stop({ t: 60 });
}

export async function restartServer(): Promise<void> {
  await mc().restart({ t: 60 });
}

// Returns a readable demuxed log stream (follow) for the WS console.
export async function getLogStream(tail = 200) {
  const stream = await mc().logs({
    follow: true,
    stdout: true,
    stderr: true,
    tail,
    timestamps: false,
  });
  return stream as NodeJS.ReadableStream;
}

// One-shot recent logs (non-follow) as a buffer -> string.
export async function getRecentLogs(tail = 200): Promise<string> {
  try {
    const buf = (await mc().logs({
      follow: false,
      stdout: true,
      stderr: true,
      tail,
      timestamps: false,
    })) as unknown as Buffer;
    return demuxToString(buf);
  } catch {
    return "";
  }
}

export { docker, mc };

// Docker multiplexes stdout/stderr with an 8-byte header per frame when no TTY.
// Strip headers to recover clean text.
export function demuxToString(buf: Buffer): string {
  const out: Buffer[] = [];
  let i = 0;
  while (i < buf.length) {
    // Header: [stream(1)][000][size(4 BE)]
    if (i + 8 > buf.length) break;
    const isHeader =
      (buf[i] === 1 || buf[i] === 2 || buf[i] === 0) &&
      buf[i + 1] === 0 &&
      buf[i + 2] === 0 &&
      buf[i + 3] === 0;
    if (isHeader) {
      const len = buf.readUInt32BE(i + 4);
      out.push(buf.subarray(i + 8, i + 8 + len));
      i += 8 + len;
    } else {
      // Not framed (TTY mode) — return raw.
      return buf.toString("utf8");
    }
  }
  return Buffer.concat(out).toString("utf8");
}
