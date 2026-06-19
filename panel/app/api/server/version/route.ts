import { NextResponse } from "next/server";
import { getVersionInfo, recreateWithEnv } from "@/lib/docker";
import { createBackup } from "@/lib/backup";
import { getSetting, setSetting } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Backup + image pull + world upgrade can take a while.
export const maxDuration = 600;

const SERVER_TYPES = ["VANILLA", "FABRIC", "PAPER", "PURPUR", "FORGE", "NEOFORGE", "QUILT"];

// Loader-based types still need a loader; only Fabric/Quilt use FABRIC_LOADER_VERSION.
const FABRIC_LIKE = ["FABRIC", "QUILT"];

export async function GET() {
  try {
    const info = await getVersionInfo();
    // The last value the panel applied (survives container recreate / restart).
    const lastApplied = getSetting("server_version") || null;
    return NextResponse.json({ ...info, lastApplied, types: SERVER_TYPES });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read version" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const type = String(body.type || "").toUpperCase().trim();
  const version = String(body.version || "").trim();
  const loaderVersion = body.loaderVersion ? String(body.loaderVersion).trim() : null;

  if (!SERVER_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `unknown server type "${type}" (allowed: ${SERVER_TYPES.join(", ")})` },
      { status: 400 }
    );
  }
  if (!version) {
    return NextResponse.json({ error: "version is required (e.g. 26.2 or LATEST)" }, { status: 400 });
  }

  // Force a world backup before mutating the container — a version change can
  // be a one-way world upgrade. If backup fails, abort: do not recreate.
  let backup;
  try {
    backup = await createBackup("manual");
  } catch (err: any) {
    return NextResponse.json(
      { error: `pre-change backup failed, aborting: ${err?.message || err}` },
      { status: 500 }
    );
  }

  // Build env overrides. Drop the Fabric loader for non-Fabric-like types so a
  // stale FABRIC_LOADER_VERSION can't confuse itzg on a vanilla switch.
  const overrides: Record<string, string | null> = {
    TYPE: type,
    VERSION: version,
    FABRIC_LOADER_VERSION: FABRIC_LIKE.includes(type) ? loaderVersion : null,
  };

  try {
    await recreateWithEnv(overrides);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: `container recreate failed: ${err?.message || err}`,
        backupId: backup.id,
      },
      { status: 500 }
    );
  }

  // Persist so the panel can show the intended version even after restarts.
  setSetting("server_version", JSON.stringify({ type, version, loaderVersion }));

  return NextResponse.json({
    ok: true,
    type,
    version,
    loaderVersion: overrides.FABRIC_LOADER_VERSION,
    backupId: backup.id,
    note: "Server recreated. itzg will download the new jar and upgrade the world on boot. On Coolify, also update the TYPE/VERSION env vars in the Coolify UI so a future deploy keeps this version.",
  });
}
