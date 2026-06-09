import { NextResponse } from "next/server";
import { restartServer } from "@/lib/docker";

export const runtime = "nodejs";

export async function POST() {
  try {
    await restartServer();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to restart server" },
      { status: 500 }
    );
  }
}
