// Runs once when the Next.js server starts (nodejs runtime only).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSchedule } = await import("@/lib/scheduler");
    try {
      initSchedule();
    } catch (e) {
      console.error("[instrumentation] schedule init failed", e);
    }
  }
}
