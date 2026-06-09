import { NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    const result = await createBackup("manual");
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Backup failed" },
      { status: 500 }
    );
  }
}
