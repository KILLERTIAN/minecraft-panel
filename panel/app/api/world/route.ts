import { NextRequest, NextResponse } from "next/server";
import { readWorldInfo } from "@/lib/nbt-reader";
import { getSetting, setSetting } from "@/lib/db";
import { applySchedule } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const info = await readWorldInfo();
  return NextResponse.json({
    ...info,
    schedule: getSetting("backup_schedule") || "",
  });
}

// Update scheduled-backup cron expression. Empty string disables.
export async function POST(req: NextRequest) {
  const { schedule } = await req.json().catch(() => ({ schedule: "" }));
  if (typeof schedule !== "string") {
    return NextResponse.json({ error: "schedule must be a string" }, { status: 400 });
  }
  setSetting("backup_schedule", schedule);
  applySchedule(schedule);
  return NextResponse.json({ ok: true, schedule });
}
