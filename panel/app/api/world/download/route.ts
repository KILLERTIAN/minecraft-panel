import { NextResponse } from "next/server";
import archiver from "archiver";
import path from "path";
import { config } from "@/lib/config";
import { saveOff, saveOn } from "@/lib/rcon";
import { getStatus } from "@/lib/docker";
import { PassThrough } from "stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const worldDir = path.join(config.mcDataPath, config.worldName);
  const status = await getStatus();

  if (status.running) {
    try {
      await saveOff();
    } catch {}
  }

  try {
    const archive = archiver("zip", { zlib: { level: 6 } });
    const pass = new PassThrough();
    archive.pipe(pass);
    archive.directory(worldDir, config.worldName);
    archive.finalize();

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      pass.on("data", (c: Buffer) => chunks.push(c));
      pass.on("end", resolve);
      pass.on("error", reject);
    });

    return new NextResponse(Buffer.concat(chunks), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${config.worldName}-${new Date().toISOString().slice(0, 10)}.zip"`,
      },
    });
  } finally {
    if (status.running) {
      try {
        await saveOn();
      } catch {}
    }
  }
}
