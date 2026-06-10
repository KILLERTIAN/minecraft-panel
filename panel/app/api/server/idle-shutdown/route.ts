import { NextRequest, NextResponse } from "next/server";
import { setSetting, getSetting } from "@/lib/db";
import { applyIdleShutdown, getIdleShutdownMinutes } from "@/lib/scheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const minutes = parseInt(getSetting("idle_shutdown_minutes") || "0", 10);
  return NextResponse.json({ minutes });
}

export async function POST(req: NextRequest) {
  const { minutes } = await req.json().catch(() => ({ minutes: 0 }));
  const m = Math.max(0, parseInt(String(minutes), 10) || 0);
  setSetting("idle_shutdown_minutes", String(m));
  applyIdleShutdown(m);
  return NextResponse.json({ ok: true, minutes: m });
}
