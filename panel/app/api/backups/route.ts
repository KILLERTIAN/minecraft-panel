import { NextResponse } from "next/server";
import { listBackups } from "@/lib/db";
import { backupLink } from "@/lib/backup";
import { getSetting } from "@/lib/db";
import { isGDriveConfigured } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = listBackups();
  return NextResponse.json({
    backups: rows.map((r) => ({ ...r, link: backupLink(r) })),
    gdriveConfigured: isGDriveConfigured(),
    schedule: getSetting("backup_schedule") || "",
  });
}
