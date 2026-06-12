"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent } from "react";
import {
  Globe2, Download, Upload, Archive, RotateCw, Trash2,
  HardDrive, Layers, Sword, Clock, Calendar, Check, AlertCircle, Loader2, Shuffle,
} from "lucide-react";

interface WorldInfo {
  name: string;
  seed: string | null;
  dayTime: number | null;
  difficulty: number | null;
  version: string | null;
  sizeBytes: number | null;
  schedule: string;
}
interface Backup {
  id: number;
  filename: string;
  size_bytes: number | null;
  type: string;
  status: string;
  created_at: string;
  link: string | null;
}

const DIFFICULTY = ["Peaceful", "Easy", "Normal", "Hard"];
const DIFF_COLORS = ["var(--accent)", "var(--blue)", "var(--warn)", "var(--danger)"];
const SCHEDULES = [
  { label: "Off", value: "" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily (3 AM)", value: "0 3 * * *" },
];

function fmtSize(b: number | null): string {
  if (!b) return "—";
  if (b > 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  return `${(b / 1e6).toFixed(1)} MB`;
}
function fmtDate(s: string): string {
  return new Date(s).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}
const RETENTION_DAYS = 7;
function daysLeft(created: string): number {
  const expiry = new Date(created).getTime() + RETENTION_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((expiry - Date.now()) / 86_400_000));
}

export default function WorldPage() {
  const [info, setInfo] = useState<WorldInfo | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [gdrive, setGdrive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [schedule, setSchedule] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [seedInput, setSeedInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [w, b] = await Promise.all([
      fetch("/api/world").then((r) => r.json()),
      fetch("/api/backups").then((r) => r.json()),
    ]);
    setInfo(w);
    setSchedule(w.schedule || "");
    setBackups(b.backups);
    setGdrive(b.gdriveConfigured);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function createBackup() {
    setBusy(true);
    setMsg("Creating backup…");
    setMsgOk(true);
    const r = await fetch("/api/backups/create", { method: "POST" });
    const d = await r.json();
    setBusy(false);
    setMsgOk(r.ok);
    setMsg(r.ok
      ? d.uploaded ? `Backed up to Drive · ${fmtSize(d.sizeBytes)}` : `Backup created locally · ${fmtSize(d.sizeBytes)}`
      : d.error || "Backup failed"
    );
    refresh();
  }

  async function restore(id: number, fn: string) {
    if (!confirm(`Restore "${fn}"?\n\nThis STOPS the server, REPLACES the current world, and restarts. Current world is moved aside as a safety copy.`)) return;
    setBusy(true);
    setMsg("Restoring… server will stop and restart");
    const r = await fetch(`/api/backups/restore/${id}`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    setMsgOk(r.ok);
    setMsg(r.ok ? "Restore complete" : d.error || "Restore failed");
    refresh();
  }

  async function del(id: number, fn: string) {
    if (!confirm(`Delete backup "${fn}"?`)) return;
    await fetch(`/api/backups/restore/${id}`, { method: "DELETE" });
    refresh();
  }

  async function changeSchedule(val: string) {
    setSchedule(val);
    await fetch("/api/world", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schedule: val }),
    });
  }

  async function downloadWorld() {
    setDownloading(true);
    setMsg("Preparing world download…");
    setMsgOk(true);
    try {
      // Sanity-check the world exists before kicking off the download so a
      // misconfigured path shows an error instead of an empty zip.
      const w = await fetch("/api/world").then((r) => r.json());
      if (!w.sizeBytes) {
        setMsg("World folder not found or empty — check WORLD_NAME / volume mount");
        setMsgOk(false);
        return;
      }
      // Navigate directly so the browser streams the zip to disk instead of
      // buffering hundreds of MB in memory.
      const a = document.createElement("a");
      a.href = "/api/world/download";
      a.download = "";
      a.click();
      setMsg(`Downloading ${w.name} (${fmtSize(w.sizeBytes)})… check your browser downloads`);
    } catch (e: any) {
      setMsg(e?.message || "Download failed");
      setMsgOk(false);
    } finally {
      setDownloading(false);
    }
  }

  async function generateWorld(seed: string) {
    const label = seed ? `seed "${seed}"` : "a random seed";
    if (!confirm(`Generate new world with ${label}?\n\nThis STOPS the server, DELETES the current world, and restarts. Current world is moved aside.`)) return;
    setResetting(true);
    setResetMsg(`Generating new world${seed ? ` (seed: ${seed})` : " (random)"}…`);
    try {
      const r = await fetch("/api/world/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      });
      const d = await r.json();
      setResetMsg(r.ok
        ? d.restarted ? `New world ready (seed: ${d.seed}) · Server restarting` : `New world ready (seed: ${d.seed})`
        : d.error || "Failed to generate world"
      );
      if (r.ok) { setSeedInput(""); refresh(); }
    } catch (e: any) {
      setResetMsg(e?.message || "Failed");
    } finally {
      setResetting(false);
    }
  }

  async function uploadWorld(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) { setUploadMsg("File must be a .zip containing your world folder"); return; }
    if (!confirm(`Upload "${file.name}" as new world?\n\nThis will STOP the server, REPLACE the current world, and restart. Current world is backed up automatically.`)) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setUploadMsg(`Uploading ${file.name}… (server will restart)`);
    const form = new FormData();
    form.append("world", file);
    try {
      const r = await fetch("/api/world/upload", { method: "POST", body: form });
      const d = await r.json();
      setUploadMsg(r.ok ? (d.restarted ? "World uploaded · Server restarted" : "World uploaded · Server was offline") : d.error || "Upload failed");
    } catch (err: any) {
      setUploadMsg(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const diffIdx = info?.difficulty ?? null;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">World & Backups</h1>
        <p className="page-sub">World info, transfer, and automated backups</p>
      </div>

      {/* Stats */}
      <div className="grid stat-grid-4" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--accent-dim)" }}>
            <Globe2 size={18} color="var(--accent)" />
          </div>
          <div className="stat-label">World</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{info?.name || "—"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "var(--blue-dim)" }}>
            <Layers size={18} color="var(--blue)" />
          </div>
          <div className="stat-label">Seed</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--text-mid)", wordBreak: "break-all", marginTop: 4, fontWeight: 500 }}>
            {info?.seed || "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: diffIdx != null ? DIFF_COLORS[diffIdx] + "22" : "var(--bg-elev2)" }}>
            <Sword size={18} color={diffIdx != null ? DIFF_COLORS[diffIdx] : "var(--text-dim)"} />
          </div>
          <div className="stat-label">Difficulty</div>
          <div className="stat-value" style={{ fontSize: 18, color: diffIdx != null ? DIFF_COLORS[diffIdx] : undefined }}>
            {diffIdx != null ? DIFFICULTY[diffIdx] : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "rgba(167,139,250,0.12)" }}>
            <HardDrive size={18} color="var(--purple)" />
          </div>
          <div className="stat-label">Size</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{fmtSize(info?.sizeBytes ?? null)}</div>
        </div>
      </div>

      {/* Generate New World */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, background: "var(--danger-glow)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <RotateCw size={18} color="var(--danger)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Generate New World</div>
            <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
              Deletes current world and generates a fresh one. Enter a seed or leave blank for random.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Seed (optional — blank = random)"
            value={seedInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSeedInput(e.target.value)}
            style={{ flex: 1, minWidth: 200, fontFamily: "var(--mono)" }}
          />
          <button className="btn-ghost" type="button" onClick={() => setSeedInput(String(Math.floor(Math.random() * 1e15)))}>
            <Shuffle size={14} />
            Random
          </button>
          <button className="btn-danger" type="button" onClick={() => generateWorld(seedInput)} disabled={resetting}>
            {resetting ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <RotateCw size={15} />}
            {resetting ? "Generating…" : "Generate World"}
          </button>
        </div>
        {resetMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: resetMsg.includes("ready") ? "var(--accent)" : resetMsg.includes("Failed") ? "var(--danger)" : "var(--text-dim)", display: "flex", alignItems: "center", gap: 6 }}>
            {resetMsg}
          </div>
        )}
      </div>

      {/* Transfer */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>World Transfer</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-primary" type="button" onClick={downloadWorld} disabled={downloading}>
            {downloading ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Download size={15} />}
            {downloading ? "Preparing…" : "Download World"}
          </button>
          <button className="btn-ghost" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Upload size={15} />}
            {uploading ? "Uploading…" : "Upload World (.zip)"}
          </button>
          <input ref={fileRef} type="file" accept=".zip" style={{ display: "none" }} onChange={uploadWorld} />
        </div>
        {(uploadMsg || msg) && (
          <div style={{ marginTop: 10, fontSize: 13, color: uploadMsg.includes("failed") || uploadMsg.includes("must") ? "var(--danger)" : "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
            {uploadMsg || msg}
          </div>
        )}
      </div>

      {/* Backups */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14, marginBottom: backups.length > 0 ? 18 : 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 38, height: 38, background: "var(--accent-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Archive size={18} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Backups</div>
              <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 2 }}>
                {gdrive ? "Stored on VPS + mirrored to Google Drive" : "Stored locally on the VPS"} · local copies auto-delete after 7 days
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select value={schedule} onChange={(e) => changeSchedule(e.target.value)} style={{ width: "auto" }}>
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>Auto: {s.label}</option>
              ))}
            </select>
            <button className="btn-primary" type="button" disabled={busy} onClick={createBackup}>
              {busy ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <Archive size={15} />}
              {busy ? "Working…" : "Backup Now"}
            </button>
          </div>
        </div>

        {msg && !uploadMsg && (
          <div style={{ marginBottom: 14, fontSize: 13, color: msgOk ? "var(--accent)" : "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            {msgOk ? <Check size={13} /> : <AlertCircle size={13} />}
            {msg}
          </div>
        )}

        {backups.length === 0 ? (
          <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "8px 0" }}>No backups yet. Create one above.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th><Calendar size={11} style={{ display: "inline", marginRight: 5 }} />Date</th>
                <th>Size</th>
                <th>Type</th>
                <th>Status</th>
                <th style={{ width: 1 }}></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td style={{ color: "var(--text)" }}>{fmtDate(b.created_at)}</td>
                  <td>{fmtSize(b.size_bytes)}</td>
                  <td>
                    <span className="chip" style={{ textTransform: "capitalize" }}>{b.type}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {b.link ? (
                        <a href={b.link} target="_blank" rel="noreferrer" className="chip chip-accent">
                          Drive ↗
                        </a>
                      ) : (
                        <span className="chip">VPS</span>
                      )}
                      <span style={{ color: daysLeft(b.created_at) <= 1 ? "var(--danger)" : "var(--text-dim)", fontSize: 11.5 }}>
                        {b.link ? "" : `expires in ${daysLeft(b.created_at)}d`}
                      </span>
                    </div>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn-ghost" disabled={busy} onClick={() => restore(b.id, b.filename)} style={{ padding: "6px 12px", fontSize: 12 }}>
                        <RotateCw size={12} />
                        Restore
                      </button>
                      <button className="btn-icon" onClick={() => del(b.id, b.filename)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
