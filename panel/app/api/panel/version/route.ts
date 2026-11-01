import { NextRequest, NextResponse } from "next/server";
import Docker from "dockerode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });
const PANEL_IMAGES = [
  "panel:latest",
  "panel:2.0.0",
];

export async function GET() {
  try {
    const containers = await docker.listContainers({ all: true });
    const panel = containers.find(
      (c) =>
        c.Labels?.["coolify.service.subName"] === "panel" ||
        c.Labels?.["coolify.serviceName"] === "panel" ||
        (c.Image?.includes("panel") && c.Names?.some((n) => n.includes("panel")))
    );

    if (!panel) {
      // Try to get panel version from local build
      try {
        const { stdout } = await execAsync("cd /app && cat package.json | grep version | head -1", { shell: "/bin/bash" });
        const match = stdout.match(/"version":\s*"([^"]+)"/);
        return NextResponse.json({
          version: match ? match[1] : "unknown",
          image: "panel:latest",
          availableImages: PANEL_IMAGES,
        });
      } catch {
        return NextResponse.json({
          version: "unknown",
          image: "panel:latest",
          availableImages: PANEL_IMAGES,
        });
      }
    }

    const container = docker.getContainer(panel.Id);
    const info = await container.inspect();

    return NextResponse.json({
      image: info.Config.Image,
      lastApplied: info.Config.Image,
      availableImages: PANEL_IMAGES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to read Panel version" },
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

  const image = String(body.image || "panel:latest").trim();

  try {
    const containers = await docker.listContainers({ all: true });
    const panel = containers.find(
      (c) =>
        c.Labels?.["coolify.service.subName"] === "panel" ||
        c.Labels?.["coolify.serviceName"] === "panel" ||
        (c.Image?.includes("panel") && c.Names?.some((n) => n.includes("panel")))
    );

    if (!panel) {
      return NextResponse.json(
        { error: "Panel container not found" },
        { status: 404 }
      );
    }

    const container = docker.getContainer(panel.Id);
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
      note: "Panel container restarted with new image",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update Panel image" },
      { status: 500 }
    );
  }
}