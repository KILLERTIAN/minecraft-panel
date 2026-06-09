import { NextResponse } from "next/server";
import { stopServer } from "@/lib/docker";

export const runtime = "nodejs";

export async function POST() {
  try {
    await stopServer();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.statusCode === 304) {
      return NextResponse.json({ ok: true, note: "already stopped" });
    }
    return NextResponse.json(
      { error: err?.message || "Failed to stop server" },
      { status: 500 }
    );
  }
}
