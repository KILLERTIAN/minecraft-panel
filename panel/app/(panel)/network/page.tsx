"use client";

import { useEffect, useState } from "react";
import { Network, Copy, Check, Wifi, Globe, Server, BookOpen, Terminal, Smartphone, RotateCw } from "lucide-react";

interface NetworkInfo {
  publicIp: string | null;
  port: number;
  javaAddress: string | null;
  localAddress: string;
  bedrockPort: number;
  bedrockAddress: string | null;
}

export default function NetworkPage() {
  const [info, setInfo] = useState<NetworkInfo | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/server/network").then((r) => r.json()).then(setInfo);
    const id = setInterval(() => {
      fetch("/api/server/network").then((r) => r.json()).then(setInfo);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  const isTailscale = info?.localAddress?.includes(".ts.net") || info?.localAddress?.includes("tailf");

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Network</h1>
        <p className="page-sub">Connection addresses for your Minecraft server</p>
      </div>

      {/* Primary address */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Wifi size={17} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{isTailscale ? "Tailscale Address" : "Server Address"}</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>Share this with players</div>
          </div>
          {isTailscale && (
            <span className="badge badge-online" style={{ marginLeft: "auto" }}>
              <span className="dot" />
              Tailscale
            </span>
          )}
        </div>

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--bg-elev2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "14px 16px",
        }}>
          <code style={{
            flex: 1,
            fontSize: 18,
            fontWeight: 800,
            color: "var(--accent)",
            fontFamily: "var(--mono)",
            wordBreak: "break-all",
            letterSpacing: "-0.3px",
          }}>
            {info?.localAddress ?? "—"}
          </code>
          <button
            className="btn-ghost"
            onClick={() => copy(info?.localAddress ?? "", "ts")}
            disabled={!info?.localAddress}
            style={{ flexShrink: 0 }}
          >
            {copied === "ts" ? <Check size={14} style={{ color: "var(--accent)" }} /> : <Copy size={14} />}
            {copied === "ts" ? "Copied!" : "Copy"}
          </button>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 10 }}>
          Minecraft → Multiplayer → Add Server → paste address above
        </div>
      </div>

      {/* Info grid */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Globe size={15} color="var(--blue)" />
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
              Public IP
            </div>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700, color: info?.publicIp ? "var(--text)" : "var(--text-dim)" }}>
            {info?.publicIp ?? "Detecting…"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>Requires port forwarding</div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Server size={15} color="var(--purple)" />
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
              Java Port
            </div>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700 }}>
            {info?.port ?? "—"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>TCP — must be open in firewall</div>
        </div>

        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Smartphone size={15} color="var(--green)" />
            <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
              Bedrock Port
            </div>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700, color: "var(--green)" }}>
            {info?.bedrockPort ?? "19132"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>UDP — Minecraft PE / Console / Win10</div>
        </div>
      </div>

      {/* Bedrock address card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "rgba(74,222,128,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Smartphone size={17} color="var(--green)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Bedrock Address</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>For MCPE, Console &amp; Windows 10 Edition</div>
          </div>
          <span className="badge badge-online" style={{ marginLeft: "auto" }}>
            <span className="dot" />
            Geyser
          </span>
        </div>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "var(--bg-elev2)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          padding: "14px 16px",
        }}>
          <code style={{
            flex: 1,
            fontSize: 18,
            fontWeight: 800,
            color: "var(--green)",
            fontFamily: "var(--mono)",
            wordBreak: "break-all",
            letterSpacing: "-0.3px",
          }}>
            {info?.bedrockAddress ?? (info?.publicIp ? `${info.publicIp}:${info.bedrockPort ?? 19132}` : "—")}
          </code>
          <button
            className="btn-ghost"
            onClick={() => copy(info?.bedrockAddress ?? "", "bedrock")}
            disabled={!info?.bedrockAddress}
            style={{ flexShrink: 0 }}
          >
            {copied === "bedrock" ? <Check size={14} style={{ color: "var(--green)" }} /> : <Copy size={14} />}
            {copied === "bedrock" ? "Copied!" : "Copy"}
          </button>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 10 }}>
          Minecraft (Bedrock) → Play → Servers → Add Server → paste address above
        </div>
      </div>

      {/* Geyser version management */}
      <GeyserVersionCard />

      {/* Port forwarding guide */}
      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 700, userSelect: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={15} color="var(--text-dim)" />
          Port Forwarding Guide
        </summary>
        <div style={{ marginTop: 16 }}>
          <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Open router admin page (usually 192.168.1.1 or 192.168.0.1)",
              'Find "Port Forwarding" or "Virtual Servers" section',
              `Add TCP rule: External Port ${info?.port ?? 25565} → Internal Port ${info?.port ?? 25565} (Java)`,
              `Add UDP rule: External Port ${info?.bedrockPort ?? 19132} → Internal Port ${info?.bedrockPort ?? 19132} (Bedrock/Geyser)`,
              "Save and restart router if needed",
            ].map((step, i) => (
              <li key={i} style={{ color: "var(--text-mid)", lineHeight: 1.7, fontSize: 13.5 }}>
                {step}
              </li>
            ))}
          </ol>
          <div style={{ marginTop: 16, background: "var(--bg-elev2)", borderRadius: "var(--radius-sm)", padding: "14px 16px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontWeight: 700, fontSize: 13 }}>
              <Terminal size={13} color="var(--accent)" />
              Firewall (Linux / VPS)
            </div>
            <code style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)", display: "block", marginBottom: 6 }}>
              ufw allow {info?.port ?? 25565}/tcp
            </code>
            <code style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--green)" }}>
              ufw allow {info?.bedrockPort ?? 19132}/udp
            </code>
          </div>
        </div>
      </details>
    </div>
  );
}

function GeyserVersionCard() {
  const [info, setInfo] = useState<{ image: string; availableImages: string[] } | null>(null);
  const [image, setImage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(true);

  useEffect(() => {
    fetch("/api/geyser/version")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setMsg(d.error); setMsgOk(false); return; }
        setInfo(d);
        setImage(d.image);
      })
      .catch((e) => { setMsg(String(e)); setMsgOk(false); });
  }, []);

  const dirty = info && image !== info.image;

  async function apply() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/geyser/version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Failed"); setMsgOk(false); setBusy(false); return; }
      setMsgOk(true);
      setMsg(`Updated to ${d.image} · ${d.note || ""}`);
      setInfo({ image, availableImages: d.availableImages || info?.availableImages || [] });
      setConfirm(false);
    } catch (e: any) {
      setMsg(e?.message || "Failed"); setMsgOk(false);
    } finally {
      setBusy(false);
    }
  }

  if (!info) return null;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, background: "var(--green-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Smartphone size={18} color="var(--green)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Geyser Version</div>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
            {info ? <>Currently running <b>{info.image}</b></> : "Loading…"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <label style={{ fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Docker Image</label>
          <select value={image} onChange={(e) => setImage(e.target.value)} disabled={!info}>
            {info?.availableImages.map((img) => <option key={img} value={img}>{img}</option>)}
          </select>
        </div>
      </div>

      {dirty && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", marginBottom: 14 }}>
          <Smartphone size={16} color="var(--green)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>
            Updating Geyser will restart the container. Bedrock players will be disconnected briefly.
            <label style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ width: "auto" }} />
              I understand, update Geyser
            </label>
          </div>
        </div>
      )}

      <button className="btn-primary" onClick={apply} disabled={!dirty || !confirm || busy} type="button">
        {busy ? (
          <><RotateCw size={14} style={{ animation: "spin 0.8s linear infinite" }} /> Updating…
        ) : (
          <><RotateCw size={14} /> Update Geyser</>
        )}
      </button>

      {msg && (
        <div style={{ marginTop: 12, fontSize: 13, color: msgOk ? "var(--green)" : "var(--danger)", display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.5 }}>
          {msgOk ? <Check size={14} style={{ flexShrink: 0, marginTop: 2 }} /> : <Smartphone size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span>{msg}</span>
        </div>
      )}
    </div>
  );
}
