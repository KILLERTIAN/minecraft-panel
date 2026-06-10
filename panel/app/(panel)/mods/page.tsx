"use client";

import { useEffect, useState } from "react";
import { Package, Loader2, HardDrive } from "lucide-react";

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
      .then((d) => { setMods(d.mods); setLoading(false); });
  }, []);

  const enabled = mods.filter((m) => m.enabled).length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Mods</h1>
        <p className="page-sub">
          Installed Fabric mods ·{" "}
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{enabled}</span> active
          {mods.length > enabled && <> · <span style={{ color: "var(--warn)" }}>{mods.length - enabled}</span> disabled</>}
        </p>
      </div>

      {loading && (
        <div style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />
          Loading mods…
        </div>
      )}

      {!loading && mods.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <Package size={36} style={{ color: "var(--text-dim)", margin: "0 auto 12px", display: "block" }} />
          <div style={{ color: "var(--text-mid)", fontWeight: 600 }}>No mods found</div>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>No .jar files in /data/mods/</div>
        </div>
      )}

      {mods.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          {mods.map((mod, i) => (
            <div
              key={mod.filename}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "13px 0",
                borderBottom: i < mods.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: mod.enabled ? "var(--accent-dim)" : "var(--bg-elev2)",
                border: `1px solid ${mod.enabled ? "rgba(34,211,160,0.2)" : "var(--border)"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <Package size={15} color={mod.enabled ? "var(--accent)" : "var(--text-dim)"} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                  {cleanName(mod.filename)}
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {mod.filename}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ color: "var(--text-dim)", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <HardDrive size={11} />
                  {fmtSize(mod.sizeBytes)}
                </span>
                <span className={`badge ${mod.enabled ? "badge-online" : "badge-offline"}`}>
                  <span className="dot" />
                  {mod.enabled ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ background: "rgba(79,142,247,0.05)", border: "1px solid rgba(79,142,247,0.15)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Package size={15} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "var(--text-mid)", lineHeight: 1.6 }}>
            To add mods: place <code style={{ fontFamily: "var(--mono)", background: "var(--bg-elev2)", padding: "1px 6px", borderRadius: 4 }}>.jar</code> files in the{" "}
            <code style={{ fontFamily: "var(--mono)", background: "var(--bg-elev2)", padding: "1px 6px", borderRadius: 4 }}>mods/</code> folder inside your{" "}
            <code style={{ fontFamily: "var(--mono)", background: "var(--bg-elev2)", padding: "1px 6px", borderRadius: 4 }}>mc-data</code> volume, then restart the server.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
