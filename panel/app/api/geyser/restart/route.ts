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
    const info = await container.inspect();
    const image = info.Config.Image || "itzg/geyser:latest";

    // Pull latest image and wait for it to complete
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: any, stream: any) => {
        if (err) { reject(err); return; }
        docker.modem.followProgress(stream, (err2: any) => err2 ? reject(err2) : resolve(), () => {});
      });
    });

    // Stop and remove container
    try {
      if (info.State.Running) await container.stop({ t: 10 });
    } catch {}
    await container.remove({ force: true });

    // Recreate with new image
    const created = await docker.createContainer({
      Image: image,
      name: info.Name?.replace(/^\//, ""),
      Env: info.Config.Env ?? undefined,
      Cmd: info.Config.Cmd ?? undefined,
      Entrypoint: info.Config.Entrypoint ?? undefined,
      Labels: info.Config.Labels ?? undefined,
      WorkingDir: info.Config.WorkingDir || undefined,
      ExposedPorts: info.Config.ExposedPorts ?? undefined,
      HostConfig: info.HostConfig,
    });

    await created.start();
    return NextResponse.json({ ok: true, note: "Geyser updated to latest and restarted" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Failed to update Geyser" },
      { status: 500 }
    );
  }
}