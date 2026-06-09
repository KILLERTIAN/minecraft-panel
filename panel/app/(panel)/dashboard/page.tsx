"use client";

import { useEffect, useState, useCallback } from "react";

interface Status {
  state: "online" | "offline" | "starting" | "unknown";
  running: boolean;
  uptimeSeconds: number | null;
  memUsageMB: number | null;
  memLimitMB: number | null;
  cpuPercent: number | null;
  serverAddress: string;
}

interface PlayersInfo {
  online: number;
  max: number;
  names: string[];
}

function fmtUptime(s: number | null): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatusBadge({ state }: { state: Status["state"] }) {
  const map = {
    online: ["badge-online", "Online"],
    starting: ["badge-starting", "Starting…"],
    offline: ["badge-offline", "Offline"],
    unknown: ["badge-offline", "Unknown"],
  } as const;
  const [cls, label] = map[state];
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {label}
    </span>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [players, setPlayers] = useState<PlayersInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/server/status");
      const d = await r.json();
      setStatus(d);
      if (d.running) {
        const pr = await fetch("/api/players/list");
        if (pr.ok) setPlayers(await pr.json());
      } else {
        setPlayers(null);
      }
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  async function action(kind: "start" | "stop" | "restart") {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/server/${kind}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setMsg(d.error || "Action failed");
    } catch (e: any) {
      setMsg(e?.message || "Action failed");
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const state = status?.state ?? "unknown";
  const canStart = state === "offline" || state === "unknown";
  const canStop = state === "online" || state === "starting";
  const canRestart = state === "online" || state === "starting";

  return (
    <>
      <div className="page-title">Dashboard</div>
      <div className="page-sub">Control your Minecraft server</div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div>
            <StatusBadge state={state} />
            <div
              style={{
                marginTop: 12,
                color: "var(--text-dim)",
                fontFamily: "var(--mono)",
              }}
            >
              {status?.serverAddress || "…"}
            </div>
          </div>
          <div className="row">
            <button
              className="btn-primary"
              disabled={busy || !canStart}
              onClick={() => action("start")}
            >
              ▶ Start
            </button>
            <button
              className="btn-ghost"
              disabled={busy || !canRestart}
              onClick={() => action("restart")}
            >
              ↺ Restart
            </button>
            <button
              className="btn-danger"
              disabled={busy || !canStop}
              onClick={() => action("stop")}
            >
              ■ Stop
            </button>
          </div>
        </div>
        {msg && <div className="error-text">{msg}</div>}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="card stat">
          <span className="label">Players</span>
          <span className="value">
            {players ? `${players.online}/${players.max}` : "—"}
          </span>
        </div>
        <div className="card stat">
          <span className="label">Uptime</span>
          <span className="value">{fmtUptime(status?.uptimeSeconds ?? null)}</span>
        </div>
        <div className="card stat">
          <span className="label">Memory</span>
          <span className="value">
            {status?.memUsageMB != null ? `${(status.memUsageMB / 1024).toFixed(1)}G` : "—"}
          </span>
        </div>
        <div className="card stat">
          <span className="label">CPU</span>
          <span className="value">
            {status?.cpuPercent != null ? `${status.cpuPercent}%` : "—"}
          </span>
        </div>
      </div>

      {players && players.names.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="stat label" style={{ marginBottom: 10 }}>
            Online now
          </div>
          <div className="row">
            {players.names.map((n) => (
              <span key={n} className="badge badge-online">
                <span className="dot" />
                {n}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
