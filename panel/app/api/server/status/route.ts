import { NextResponse } from "next/server";
import { getStatus } from "@/lib/docker";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getStatus();
  return NextResponse.json({
    ...status,
    serverAddress: config.serverAddress,
    bedrockPort: config.bedrockPort,
  });
}
