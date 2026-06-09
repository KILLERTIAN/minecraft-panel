import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { config } from "@/lib/config";
import { whitelistAdd, whitelistRemove, whitelistReload } from "@/lib/rcon";
import { getUuid, avatarUrl } from "@/lib/mojang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Entry {
  uuid: string;
  name: string;
}

function whitelistPath(): string {
  return path.join(config.mcDataPath, "whitelist.json");
}

async function readWhitelist(): Promise<Entry[]> {
  try {
    const raw = await fs.readFile(whitelistPath(), "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function GET() {
  const entries = await readWhitelist();
  return NextResponse.json({
    entries: entries.map((e) => ({
      ...e,
      avatar: avatarUrl(e.name),
    })),
  });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({ name: "" }));
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  // Validate the username exists.
  const uuid = await getUuid(name);
  if (!uuid) {
    return NextResponse.json(
      { error: `"${name}" is not a valid Minecraft username` },
      { status: 400 }
    );
  }
  try {
    // RCON does the add + persists to whitelist.json + applies live.
    const out = await whitelistAdd(name);
    await whitelistReload();
    return NextResponse.json({ ok: true, output: out });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server must be online to edit whitelist" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { name } = await req.json().catch(() => ({ name: "" }));
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    const out = await whitelistRemove(name);
    await whitelistReload();
    return NextResponse.json({ ok: true, output: out });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server must be online to edit whitelist" },
      { status: 500 }
    );
  }
}
