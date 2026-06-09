"use client";

import { useEffect, useState, useCallback, useRef, ChangeEvent } from "react";

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
  return new Date(s).toLocaleString();
}

export default function WorldPage() {
  const [info, setInfo] = useState<WorldInfo | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [gdrive, setGdrive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
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

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function createBackup() {
    setBusy(true);
    setMsg("Creating backup…");
    const r = await fetch("/api/backups/create", { method: "POST" });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      setMsg(
        d.uploaded
          ? `Backed up to Drive ✓ (${fmtSize(d.sizeBytes)})`
          : `Backup created locally (${fmtSize(d.sizeBytes)})`
      );
      refresh();
    } else setMsg(d.error || "Backup failed");
  }

  async function restore(id: number, fn: string) {
    if (
      !confirm(
        `Restore "${fn}"?\n\nThis STOPS the server, REPLACES the current world, and restarts. Current world is moved aside as a safety copy.`
      )
    )
      return;
    setBusy(true);
    setMsg("Restoring… server will stop and restart");
    const r = await fetch(`/api/backups/restore/${id}`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    setMsg(r.ok ? "Restore complete ✓" : d.error || "Restore failed");
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
    try {
      const r = await fetch("/api/world/download");
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setMsg(d.error || "Download failed");
        return;
      }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const fnMatch = cd.match(/filename="([^"]+)"/);
      const filename = fnMatch?.[1] || "world.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setMsg(`Downloaded ${filename} ✓`);
    } catch (e: any) {
      setMsg(e?.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  async function generateWorld(seed: string) {
    const label = seed ? `seed "${seed}"` : "a random seed";
    if (
      !confirm(
        `Generate new world with ${label}?\n\nThis STOPS the server, DELETES the current world, and restarts. The current world is moved aside as a safety copy.`
      )
    )
      return;
    setResetting(true);
    setResetMsg(`Generating new world${seed ? ` (seed: ${seed})` : " (random)"}… server will restart`);
    try {
      const r = await fetch("/api/world/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      });
      const d = await r.json();
      if (r.ok) {
        setResetMsg(
          d.restarted
            ? `New world generated (seed: ${d.seed}) — server restarting ✓`
            : `New world ready (seed: ${d.seed}) — server was offline`
        );
        setSeedInput("");
        refresh();
      } else {
        setResetMsg(d.error || "Failed to generate world");
      }
    } catch (e: any) {
      setResetMsg(e?.message || "Failed to generate world");
    } finally {
      setResetting(false);
    }
  }

  async function uploadWorld(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".zip")) {
      setUploadMsg("File must be a .zip containing your world folder");
      return;
    }
    if (
      !confirm(
        `Upload "${file.name}" as the new world?\n\nThis will STOP the server, REPLACE the current world, and restart. Current world is backed up automatically.`
      )
    ) {
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
      if (r.ok) {
        setUploadMsg(
          d.restarted
            ? "World uploaded and server restarted ✓"
            : "World uploaded ✓ (server was offline)"
        );
        refresh();
      } else {
        setUploadMsg(d.error || "Upload failed");
      }
    } catch (err: any) {
      setUploadMsg(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className="page-title">World &amp; Backups</div>
      <div className="page-sub">World info, download/upload, Google Drive backups &amp; restore</div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 16 }}
      >
        <div className="card stat">
          <span className="label">World</span>
          <span className="value" style={{ fontSize: 18 }}>
            {info?.name || "—"}
          </span>
        </div>
        <div className="card stat">
          <span className="label">Seed</span>
          <span
            className="value"
            style={{ fontSize: 13, fontFamily: "var(--mono)", wordBreak: "break-all" }}
          >
            {info?.seed || "—"}
          </span>
        </div>
        <div className="card stat">
          <span className="label">Difficulty</span>
          <span className="value" style={{ fontSize: 18 }}>
            {info?.difficulty != null ? DIFFICULTY[info.difficulty] : "—"}
          </span>
        </div>
        <div className="card stat">
          <span className="label">Size</span>
          <span className="value" style={{ fontSize: 18 }}>
            {fmtSize(info?.sizeBytes ?? null)}
          </span>
        </div>
      </div>

      {/* New World Generation */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Generate New World</div>
        <div style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 14 }}>
          Deletes the current world and generates a fresh one. Enter a seed or leave blank for random.
          Current world is moved aside automatically.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Seed (optional — blank = random)"
            value={seedInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSeedInput(e.target.value)}
            style={{
              flex: 1,
              minWidth: 200,
              background: "var(--bg-elev2)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "var(--radius)",
              padding: "10px 12px",
              fontFamily: "var(--mono)",
            }}
          />
          <button
            className="btn-ghost"
            onClick={() => setSeedInput(String(Math.floor(Math.random() * 1e15)))}
            style={{ whiteSpace: "nowrap" }}
          >
            Random Seed
          </button>
          <button
            className="btn-danger"
            onClick={() => generateWorld(seedInput)}
            disabled={resetting}
            style={{ whiteSpace: "nowrap" }}
          >
            {resetting ? "Generating…" : "Generate World"}
          </button>
        </div>
        {resetMsg && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: resetMsg.includes("✓")
                ? "var(--accent)"
                : resetMsg.includes("Failed")
                ? "var(--danger)"
                : "var(--text-dim)",
            }}
          >
            {resetMsg}
          </div>
        )}
      </div>

      {/* Download / Upload */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>World Transfer</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <button
              className="btn-primary"
              onClick={downloadWorld}
              disabled={downloading}
            >
              {downloading ? "Preparing…" : "⬇ Download World"}
            </button>
            <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>
              Downloads a .zip of the current world
            </div>
          </div>
          <div>
            <button
              className="btn-ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "Uploading…" : "⬆ Upload World (.zip)"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip"
              style={{ display: "none" }}
              onChange={uploadWorld}
            />
            <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>
              Upload a world .zip to replace current world
            </div>
          </div>
        </div>
        {uploadMsg && (
          <div
            style={{
              marginTop: 10,
              fontSize: 13,
              color: uploadMsg.includes("✓") ? "var(--accent)" : uploadMsg.includes("failed") || uploadMsg.includes("must") ? "var(--danger)" : "var(--text-dim)",
            }}
          >
            {uploadMsg}
          </div>
        )}
        {msg && (
          <div
            style={{
              marginTop: 6,
              fontSize: 13,
              color: msg.includes("✓") ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            {msg}
          </div>
        )}
      </div>

      {/* Backup controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Backups</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>
              {gdrive
                ? "Uploads to Google Drive"
                : "Google Drive not configured — backups stay local"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={schedule}
              onChange={(e) => changeSchedule(e.target.value)}
              style={{
                background: "var(--bg-elev2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: "var(--radius)",
                padding: "10px 12px",
              }}
            >
              {SCHEDULES.map((s) => (
                <option key={s.value} value={s.value}>
                  Auto: {s.label}
                </option>
              ))}
            </select>
            <button className="btn-primary" disabled={busy} onClick={createBackup}>
              {busy ? "Working…" : "Backup Now"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        {backups.length === 0 ? (
          <div style={{ color: "var(--text-dim)" }}>No backups yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Size</th>
                <th>Type</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>{fmtDate(b.created_at)}</td>
                  <td>{fmtSize(b.size_bytes)}</td>
                  <td style={{ textTransform: "capitalize" }}>{b.type}</td>
                  <td>
                    {b.link ? (
                      <a
                        href={b.link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent)" }}
                      >
                        Drive ↗
                      </a>
                    ) : (
                      <span style={{ color: "var(--warn)" }}>{b.status}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button
                      className="btn-ghost"
                      disabled={busy}
                      onClick={() => restore(b.id, b.filename)}
                      style={{ padding: "6px 12px", marginRight: 6 }}
                    >
                      Restore
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => del(b.id, b.filename)}
                      style={{ padding: "6px 12px" }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
