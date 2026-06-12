import { NextResponse } from "next/server";
import archiver from "archiver";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { saveOff, saveOn } from "@/lib/rcon";
import { getStatus } from "@/lib/docker";
import { resolveWorldDir } from "@/lib/nbt-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const worldDir = resolveWorldDir();
  if (!fs.existsSync(path.join(worldDir, "level.dat"))) {
    return NextResponse.json(
      { error: `World folder not found (looked at ${worldDir})` },
      { status: 404 }
    );
  }

  const worldName = path.basename(worldDir);
  const status = await getStatus();

  if (status.running) {
    try {
      await saveOff();
    } catch {}
  }

  const archive = archiver("zip", { zlib: { level: 6 } });
  archive.directory(worldDir, worldName);

  const resumeSaves = () => {
    if (status.running) {
      saveOn().catch((e: any) =>
        console.error("[download] failed to re-enable saves:", e?.message)
      );
    }
  };
  archive.on("end", resumeSaves);
  archive.on("error", resumeSaves);
  archive.finalize();

  // Stream the zip as it's built — worlds can be hundreds of MB.
  return new NextResponse(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${worldName}-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
