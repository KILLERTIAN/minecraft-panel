import cron, { ScheduledTask } from "node-cron";
import { createBackup } from "./backup";
import { getSetting } from "./db";

let task: ScheduledTask | null = null;

// Apply (or clear) the scheduled-backup cron. Empty/invalid string disables it.
export function applySchedule(expr: string): void {
  if (task) {
    task.stop();
    task = null;
  }
  if (!expr || !cron.validate(expr)) return;
  task = cron.schedule(expr, async () => {
    try {
      await createBackup("scheduled");
      console.log("[scheduler] scheduled backup complete");
    } catch (e: any) {
      console.error("[scheduler] backup failed:", e?.message);
    }
  });
  console.log(`[scheduler] backup schedule active: ${expr}`);
}

// Called once at server boot to restore persisted schedule.
export function initSchedule(): void {
  const saved = getSetting("backup_schedule") || process.env.BACKUP_SCHEDULE || "";
  if (saved) applySchedule(saved);
}
