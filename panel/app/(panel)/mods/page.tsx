"use client";

import { useEffect, useState } from "react";

interface ModInfo {
  filename: string;
  sizeBytes: number;
  enabled: boolean;
}

function fmtSize(b: number): string {
  if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${Math.round(b / 1024)} KB`;
}

function cleanName(filename: string): string {
  return filename
    .replace(/\.jar(\.disabled)?$/, "")
    .replace(/[-_](\d+\.)+\d+.*$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ModsPage() {
  const [mods, setMods] = useState<ModInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/server/mods")
      .then((r) => r.json())
      .then((d) => {
        setMods(d.mods);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <div className="page-title">Mods</div>
      <div className="page-sub">
        Installed Fabric mods · {mods.length} total
      </div>

      {loading && <div style={{ color: "var(--text-dim)" }}>Loading…</div>}

      {!loading && mods.length === 0 && (
        <div className="card" style={{ color: "var(--text-dim)" }}>
          No mods found in /data/mods/
        </div>
      )}

      <div className="card">
        {mods.map((mod) => (
          <div
            key={mod.filename}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: mod.enabled ? "var(--accent)" : "var(--text-dim)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {cleanName(mod.filename)}
              </div>
              <div
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: 11,
                  color: "var(--text-dim)",
                  marginTop: 2,
                }}
              >
                {mod.filename}
              </div>
            </div>
            <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
              {fmtSize(mod.sizeBytes)}
            </div>
            <span
              className={`badge ${mod.enabled ? "badge-online" : "badge-offline"}`}
            >
              <span className="dot" />
              {mod.enabled ? "Active" : "Disabled"}
            </span>
          </div>
        ))}
      </div>

      <div
        className="card"
        style={{ marginTop: 16, color: "var(--text-dim)", fontSize: 13 }}
      >
        To add mods: place <code style={{ fontFamily: "var(--mono)" }}>.jar</code> files in the{" "}
        <code style={{ fontFamily: "var(--mono)" }}>mods/</code> folder inside your Docker volume (
        <code style={{ fontFamily: "var(--mono)" }}>mc-data</code>), then restart the server.
      </div>
    </>
  );
}
