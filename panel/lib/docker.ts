import Docker from "dockerode";
import { config } from "./config";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export type ServerState = "online" | "offline" | "starting" | "unknown";

async function resolveMcContainerName(): Promise<string> {
  try {
    await docker.getContainer(config.mcContainer).inspect();
    return config.mcContainer;
  } catch {}
  // Coolify randomises container names — find by label or image.
  const containers = await docker.listContainers({ all: true });
  const found = containers.find(
    (c) =>
      c.Labels?.["coolify.service.subName"] === "minecraft" ||
      c.Labels?.["coolify.serviceName"] === "minecraft" ||
      (c.Image?.includes("minecraft-server") && c.Names?.some((n) => n.includes("minecraft")))
  );
  if (found) return found.Id;
  return config.mcContainer;
}

let _mcName: string | null = null;

async function getMcName(): Promise<string> {
  if (_mcName) {
    try { await docker.getContainer(_mcName).inspect(); return _mcName; } catch { _mcName = null; }
  }
  _mcName = await resolveMcContainerName();
  return _mcName;
}

async function mcAsync() {
  const name = await getMcName();
  return docker.getContainer(name);
}

export interface ServerStatus {
  state: ServerState;
  running: boolean;
  health: string | null;
  startedAt: string | null;
  uptimeSeconds: number | null;
  memUsageMB: number | null;
  memLimitMB: number | null;
  cpuPercent: number | null;
}

export async function getStatus(): Promise<ServerStatus> {
  try {
    const c = await mcAsync();
    const info = await c.inspect();
    const running = info.State.Running === true;
    const health = info.State.Health?.Status ?? null;

    let state: ServerState = running ? "online" : "offline";
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
        const stats = await c.stats({ stream: false });
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

    return { state, running, health, startedAt, uptimeSeconds, memUsageMB, memLimitMB, cpuPercent };
  } catch (err: any) {
    if (err?.statusCode === 404) return blank("offline");
    return blank("unknown");
  }
}

function blank(state: ServerState): ServerStatus {
  return { state, running: false, health: null, startedAt: null, uptimeSeconds: null, memUsageMB: null, memLimitMB: null, cpuPercent: null };
}

function computeCpu(stats: any): number | null {
  try {
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cores = stats.cpu_stats.online_cpus || stats.cpu_stats.cpu_usage.percpu_usage?.length || 1;
    if (sysDelta > 0 && cpuDelta > 0) return Math.round((cpuDelta / sysDelta) * cores * 100 * 10) / 10;
  } catch { /* ignore */ }
  return null;
}

export async function startServer(): Promise<void> {
  await (await mcAsync()).start();
}

export async function stopServer(): Promise<void> {
  await (await mcAsync()).stop({ t: 60 });
}

export async function restartServer(): Promise<void> {
  await (await mcAsync()).restart({ t: 60 });
}

export async function getLogStream(tail = 200) {
  const stream = await (await mcAsync()).logs({
    follow: true, stdout: true, stderr: true, tail, timestamps: false,
  });
  return stream as NodeJS.ReadableStream;
}

export async function getRecentLogs(tail = 200): Promise<string> {
  try {
    const buf = (await (await mcAsync()).logs({
      follow: false, stdout: true, stderr: true, tail, timestamps: false,
    })) as unknown as Buffer;
    return demuxToString(buf);
  } catch {
    return "";
  }
}

export { docker, mcAsync as mc };

export function demuxToString(buf: Buffer): string {
  const out: Buffer[] = [];
  let i = 0;
  while (i < buf.length) {
    if (i + 8 > buf.length) break;
    const isHeader =
      (buf[i] === 1 || buf[i] === 2 || buf[i] === 0) &&
      buf[i + 1] === 0 && buf[i + 2] === 0 && buf[i + 3] === 0;
    if (isHeader) {
      const len = buf.readUInt32BE(i + 4);
      out.push(buf.subarray(i + 8, i + 8 + len));
      i += 8 + len;
    } else {
      return buf.toString("utf8");
    }
  }
  return Buffer.concat(out).toString("utf8");
}
