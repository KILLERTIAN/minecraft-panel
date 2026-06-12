import cron, { ScheduledTask } from "node-cron";
import { createBackup, cleanupOldBackups } from "./backup";
import { getSetting } from "./db";
import { listPlayers } from "./rcon";
import { stopServer, getStatus } from "./docker";

let backupTask: ScheduledTask | null = null;
let cleanupTask: ScheduledTask | null = null;
let idleTask: ScheduledTask | null = null;
let idleSinceMs: number | null = null;
let idleTimeoutMinutes = 0;

export function applySchedule(expr: string): void {
  if (backupTask) { backupTask.stop(); backupTask = null; }
  if (!expr || !cron.validate(expr)) return;
  backupTask = cron.schedule(expr, async () => {
    try {
      await createBackup("scheduled");
      console.log("[scheduler] scheduled backup complete");
    } catch (e: any) {
      console.error("[scheduler] backup failed:", e?.message);
    }
  });
  console.log(`[scheduler] backup schedule active: ${expr}`);
}

export function applyIdleShutdown(minutes: number): void {
  if (idleTask) { idleTask.stop(); idleTask = null; }
  idleTimeoutMinutes = minutes;
  idleSinceMs = null;
  if (minutes <= 0) return;

  // Check every 30 seconds.
  idleTask = cron.schedule("*/30 * * * * *", async () => {
    try {
      const status = await getStatus();
      if (!status.running) { idleSinceMs = null; return; }

      const { names } = await listPlayers().catch(() => ({ names: [] as string[] }));
      if (names.length > 0) {
        idleSinceMs = null;
        return;
      }

      const now = Date.now();
      if (idleSinceMs === null) {
        idleSinceMs = now;
        console.log(`[scheduler] idle started, will shut down in ${minutes} min`);
        return;
      }

      const idleMs = now - idleSinceMs;
      const idleMinElapsed = Math.round(idleMs / 60000);
      console.log(`[scheduler] idle ${idleMinElapsed}/${minutes} min`);
      if (idleMs >= minutes * 60 * 1000) {
        console.log(`[scheduler] server idle ${minutes}min — shutting down`);
        idleSinceMs = null;
        await stopServer().catch((e: any) => console.error("[scheduler] idle stop failed:", e?.message));
      }
    } catch (e: any) {
      console.error("[scheduler] idle check failed:", e?.message);
    }
  });
  console.log(`[scheduler] idle shutdown active: ${minutes} min`);
}

export function getIdleShutdownMinutes(): number {
  return idleTimeoutMinutes;
}

export function initSchedule(): void {
  const saved = getSetting("backup_schedule") || process.env.BACKUP_SCHEDULE || "";
  if (saved) applySchedule(saved);

  // Prune expired local backups daily, and once at startup.
  if (cleanupTask) { cleanupTask.stop(); cleanupTask = null; }
  cleanupTask = cron.schedule("15 4 * * *", () => {
    cleanupOldBackups().catch((e: any) =>
      console.error("[scheduler] backup cleanup failed:", e?.message)
    );
  });
  cleanupOldBackups().catch(() => {});

  const idleMin = parseInt(
    getSetting("idle_shutdown_minutes") || process.env.IDLE_SHUTDOWN_MINUTES || "0",
    10
  );
  console.log(`[scheduler] idle_shutdown_minutes = ${idleMin}`);
  if (idleMin > 0) applyIdleShutdown(idleMin);
}
