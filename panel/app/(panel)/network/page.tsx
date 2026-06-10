"use client";

import { useEffect, useState } from "react";
import { Network, Copy, Check, Wifi, Globe, Server, BookOpen, Terminal } from "lucide-react";

interface NetworkInfo {
  publicIp: string | null;
  port: number;
  javaAddress: string | null;
  localAddress: string;
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
              Minecraft Port
            </div>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 17, fontWeight: 700 }}>
            {info?.port ?? "—"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>TCP — must be open in firewall</div>
        </div>
      </div>

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
              `Add rule: Protocol TCP · External Port ${info?.port ?? 25565} · Internal Port ${info?.port ?? 25565}`,
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
            <code style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--accent)" }}>
              ufw allow {info?.port ?? 25565}/tcp
            </code>
          </div>
        </div>
      </details>
    </div>
  );
}
