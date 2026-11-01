import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const GeyserImages = [
  "itzg/geyser",
  "itzg/geyser:latest",
];

export async function GET() {
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
    const info = await container.inspect();

    return NextResponse.json({
      image: info.Config.Image,
      lastApplied: info.Config.Image,
      availableImages: GeyserImages,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read Geyser version" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const image = String(body.image || "itzg/geyser:latest").trim();

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
    const info = await container.inspect();

    // Stop and remove existing container
    try {
      if (info.State.Running) await container.stop({ t: 10 });
    } catch {}
    await container.remove({ force: true });

    // Recreate with new image
    const created = await docker.createContainer({
      Image: image,
      Name: info.Name?.replace(/^\//, ""),
      Env: info.Config.Env ?? undefined,
      Cmd: info.Config.Cmd ?? undefined,
      Entrypoint: info.Config.Entrypoint ?? undefined,
      Labels: info.Config.Labels ?? undefined,
      WorkingDir: info.Config.WorkingDir || undefined,
      ExposedPorts: info.Config.ExposedPorts ?? undefined,
      HostConfig: info.HostConfig,
    });

    await created.start();
    return NextResponse.json({
      ok: true,
      image,
      note: "Geyser container restarted with new image",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update Geyser image" },
      { status: 500 }
    );
  }
}