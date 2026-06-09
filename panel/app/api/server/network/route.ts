import { NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getServerPort(): Promise<number> {
  try {
    const raw = await fs.readFile(
      path.join(config.mcDataPath, "server.properties"),
      "utf8"
    );
    const m = raw.match(/^server-port=(\d+)/m);
    return m ? parseInt(m[1], 10) : 25565;
  } catch {
    return 25565;
  }
}

async function getPublicIp(): Promise<string | null> {
  for (const url of [
    "https://api.ipify.org",
    "https://icanhazip.com",
    "https://checkip.amazonaws.com",
  ]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      const text = (await r.text()).trim();
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(text)) return text;
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET() {
  const [port, publicIp] = await Promise.all([getServerPort(), getPublicIp()]);

  return NextResponse.json({
    publicIp,
    port,
    javaAddress: publicIp ? `${publicIp}:${port}` : null,
    localAddress: config.serverAddress,
  });
}
