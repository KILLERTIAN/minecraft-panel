import { NextResponse } from "next/server";
import Docker from "dockerode";

export const runtime = "nodejs";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

export async function POST() {
  try {
    const containers = await docker.listContainers({ all: true });
    const geyser = containers.find(
      (c) =>
        c.Labels?.["coolify.service.subName"] === "geyser" ||
        c.Labels?.["coolify.serviceName"] === "geyser" ||
        (c.Image?.includes("geyser") && c.Names?.some((n) => n.includes("geyser")))
    );

    if (!geyser) {
      return NextResponse.json(
        { error: "Geyser container not found" },
        { status: 404 }
      );
    }

    const container = docker.getContainer(geyser.Id);
    await container.restart({ t: 10 });
    return NextResponse.json({ ok: true, note: "Geyser container restarting" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to restart Geyser" },
      { status: 500 }
    );
  }
}