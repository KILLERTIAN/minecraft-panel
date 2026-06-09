import { NextResponse } from "next/server";
import { startServer } from "@/lib/docker";

export const runtime = "nodejs";

export async function POST() {
  try {
    await startServer();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.statusCode === 304) {
      return NextResponse.json({ ok: true, note: "already running" });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to start server" },
      { status: 500 }
    );
  }
}
