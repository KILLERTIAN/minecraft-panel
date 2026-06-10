"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Play,
  Square,
  RotateCw,
  Users,
  Clock,
  MemoryStick,
  Cpu,
  Loader2,
  Wifi,
  WifiOff,
  Copy,
  Check,
} from "lucide-react";

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
    online: { cls: "badge-online", label: "Online" },
    starting: { cls: "badge-starting", label: "Starting…" },
    offline: { cls: "badge-offline", label: "Offline" },
    unknown: { cls: "badge-offline", label: "Unknown" },
  };
  const { cls, label } = map[state];
  return (
    <span className={`badge ${cls}`} style={{ fontSize: 13, padding: "5px 12px" }}>
      <span className="dot" />
      {label}
    </span>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="stat-card animate-in">
      <div className="stat-icon" style={{ background: accent + "22" }}>
        <div style={{ color: accent }}>{icon}</div>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && (
        <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 4 }}>{sub}</div>
      )}
      {progress != null && (
        <div className="progress-bar" style={{ marginTop: 10 }}>
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(100, progress)}%`,
              background: progress > 80 ? "var(--danger)" : progress > 60 ? "var(--warn)" : accent,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [players, setPlayers] = useState<PlayersInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);

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
    } catch {}
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

  async function copyAddress() {
    if (!status?.serverAddress) return;
    await navigator.clipboard.writeText(status.serverAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const state = status?.state ?? "unknown";
  const canStart = state === "offline" || state === "unknown";
  const canStop = state === "online" || state === "starting";
  const canRestart = state === "online" || state === "starting";
  const memPct = status?.memUsageMB && status?.memLimitMB
    ? (status.memUsageMB / status.memLimitMB) * 100
    : null;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Monitor and control your Minecraft server</p>
      </div>

      {/* Server Control Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <StatusBadge state={state} />
            <button
              onClick={copyAddress}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "7px 12px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                color: "var(--text-dim)",
                fontFamily: "var(--mono)",
                fontSize: 13,
                transition: "all var(--transition)",
                width: "fit-content",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)";
                (e.currentTarget as HTMLElement).style.color = "var(--text)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.color = "var(--text-dim)";
              }}
            >
              {state === "online" ? (
                <Wifi size={13} style={{ color: "var(--accent)" }} />
              ) : (
                <WifiOff size={13} />
              )}
              {status?.serverAddress || "…"}
              {copied ? <Check size={12} style={{ color: "var(--accent)" }} /> : <Copy size={12} />}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn-primary"
              disabled={busy || !canStart}
              onClick={() => action("start")}
            >
              {busy ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Play size={15} />}
              Start
            </button>
            <button
              className="btn-ghost"
              disabled={busy || !canRestart}
              onClick={() => action("restart")}
            >
              <RotateCw size={15} />
              Restart
            </button>
            <button
              className="btn-danger"
              disabled={busy || !canStop}
              onClick={() => action("stop")}
            >
              <Square size={15} />
              Stop
            </button>
          </div>
        </div>
        {msg && (
          <div style={{ marginTop: 12, fontSize: 13, color: "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            {msg}
          </div>
        )}
      </div>

      {/* Stat Grid */}
      <div className="grid stat-grid-4" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <StatCard
          icon={<Users size={18} />}
          label="Players"
          value={players ? `${players.online}/${players.max}` : "—"}
          sub={players?.online ? `${players.online} online` : "No players"}
          accent="var(--accent)"
          progress={players ? (players.online / Math.max(players.max, 1)) * 100 : undefined}
        />
        <StatCard
          icon={<Clock size={18} />}
          label="Uptime"
          value={fmtUptime(status?.uptimeSeconds ?? null)}
          sub={status?.state === "online" ? "Running" : "Stopped"}
          accent="var(--blue)"
        />
        <StatCard
          icon={<MemoryStick size={18} />}
          label="Memory"
          value={status?.memUsageMB != null ? `${(status.memUsageMB / 1024).toFixed(1)} GB` : "—"}
          sub={status?.memLimitMB ? `of ${(status.memLimitMB / 1024).toFixed(0)} GB` : undefined}
          accent="var(--purple)"
          progress={memPct ?? undefined}
        />
        <StatCard
          icon={<Cpu size={18} />}
          label="CPU"
          value={status?.cpuPercent != null ? `${status.cpuPercent}%` : "—"}
          sub="Server load"
          accent="var(--warn)"
          progress={status?.cpuPercent ?? undefined}
        />
      </div>

      {/* Online Players */}
      {players && players.names.length > 0 && (
        <div className="card animate-in">
          <div className="section-title">
            <Users size={14} />
            Online now
          </div>
          <div className="row">
            {players.names.map((n) => (
              <span key={n} className="badge badge-online" style={{ fontSize: 13, padding: "5px 12px" }}>
                <span className="dot" />
                {n}
              </span>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
