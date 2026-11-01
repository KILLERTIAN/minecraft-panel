"use client";

import { useEffect, useState, useRef } from "react";
import { Package, Loader2, HardDrive, Upload } from "lucide-react";

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
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [uploadMsgOk, setUploadMsgOk] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const d = await fetch("/api/server/mods").then((r) => r.json()).catch(() => ({ mods: [] }));
    setMods(d.mods);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const enabled = mods.filter((m) => m.enabled).length;

  async function uploadMod(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".jar")) {
      setUploadMsg("File must be a .jar file (Fabric/Forge mod)");
      setUploadMsgOk(false);
      return;
    }
    if (!confirm(`Upload "${file.name}" as a mod?\n\nThis will stop the server, install the mod, and restart.`)) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setUploadMsg("");
    const form = new FormData();
    form.append("mod", file);
    try {
      const r = await fetch("/api/mods/upload", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) {
        setUploadMsg(d.error || "Upload failed");
        setUploadMsgOk(false);
      } else {
        setUploadMsg(d.restarted ? `Mod installed · Server restarted` : `Mod installed · Server was offline`);
        setUploadMsgOk(true);
        refresh();
      }
    } catch (err: any) {
      setUploadMsg(err?.message || "Upload failed");
      setUploadMsgOk(false);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

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

      {/* Upload Mod Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 38, height: 38, background: "var(--accent-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={18} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Install Mod</div>
            <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
              Upload a .jar file to add a Fabric or Forge mod to your server.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
          <button
            className="btn-primary"
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />
            ) : (
              <Upload size={15} />
            )}
            {uploading ? "Uploading…" : "Upload .jar Mod"}
          </button>
          <input ref={fileRef} type="file" accept=".jar" style={{ display: "none" }} onChange={uploadMod} />
        </div>
        {uploadMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: uploadMsgOk ? "var(--accent)" : "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            {uploadMsgOk ? <span style={{ fontSize: 13 }}>✔</span> : <span style={{ fontSize: 13 }}>⚠</span>}
            {uploadMsg}
          </div>
        )}
      </div>

      <div className="card" style={{ background: "rgba(79,142,247,0.05)", border: "1px solid rgba(79,142,247,0.15)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Package size={15} color="var(--blue)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: "var(--text-mid)", lineHeight: 1.6 }}>
            <strong>Note:</strong> To manually add mods, place <code style={{ fontFamily: "var(--mono)", background: "var(--bg-elev2)", padding: "1px 6px", borderRadius: 4 }}>.jar</code> files in the{" "}
            <code style={{ fontFamily: "var(--mono)", background: "var(--bg-elev2)", padding: "1px 6px", borderRadius: 4 }}>mods/</code> folder inside your{" "}
            <code style={{ fontFamily: "var(--mono)", background: "var(--bg-elev2)", padding: "1px 6px", borderRadius: 4 }}>mc-data</code> volume.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
