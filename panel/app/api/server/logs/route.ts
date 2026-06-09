import { NextRequest, NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/docker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tail = parseInt(req.nextUrl.searchParams.get("tail") || "200", 10);
  const logs = await getRecentLogs(Math.min(tail, 1000));
  return NextResponse.json({ logs });
}
