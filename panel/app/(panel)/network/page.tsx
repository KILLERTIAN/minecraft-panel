"use client";

import { useEffect, useState } from "react";

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
    <>
      <div className="page-title">Network</div>
      <div className="page-sub">Connection addresses for your server</div>

      {/* Primary: share address */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {isTailscale ? "Tailscale Address" : "Server Address"}
          </div>
          {isTailscale && (
            <span className="badge badge-online">
              <span className="dot" />
              Tailscale
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bg-elev2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "12px 16px",
            marginBottom: 8,
          }}
        >
          <code style={{ flex: 1, fontSize: 18, fontWeight: 700, color: "var(--accent)", wordBreak: "break-all" }}>
            {info?.localAddress ?? "…"}
          </code>
          <button
            className="btn-ghost"
            onClick={() => copy(info?.localAddress ?? "", "ts")}
            style={{ whiteSpace: "nowrap" }}
            disabled={!info?.localAddress}
          >
            {copied === "ts" ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>
          {isTailscale
            ? "Friends must be on your Tailscale tailnet. Share this in Minecraft → Multiplayer → Add Server."
            : "Share this address with players → Multiplayer → Add Server."}
        </div>
      </div>

      {/* Secondary info */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 16 }}>
        <div className="card">
          <div className="stat label" style={{ marginBottom: 8 }}>Public IP</div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 18,
              fontWeight: 700,
              color: info?.publicIp ? "var(--text)" : "var(--text-dim)",
            }}
          >
            {info?.publicIp ?? "Detecting…"}
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 6 }}>
            Requires port forwarding
          </div>
        </div>

        <div className="card">
          <div className="stat label" style={{ marginBottom: 8 }}>Minecraft Port</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 18, fontWeight: 700 }}>
            {info?.port ?? "…"}
          </div>
        </div>
      </div>

      <details className="card">
        <summary style={{ cursor: "pointer", fontWeight: 700, userSelect: "none", padding: "4px 0" }}>
          Port Forwarding Guide
        </summary>
        <ol style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
          <li style={{ color: "var(--text)", lineHeight: 1.6 }}>Open router admin page (usually 192.168.1.1 or 192.168.0.1)</li>
          <li style={{ color: "var(--text)", lineHeight: 1.6 }}>Find "Port Forwarding" or "Virtual Servers" section</li>
          <li style={{ color: "var(--text)", lineHeight: 1.6 }}>
            Add rule: Protocol TCP, External Port {info?.port ?? 25565}, Internal IP (your machine's LAN IP), Internal Port {info?.port ?? 25565}
          </li>
          <li style={{ color: "var(--text)", lineHeight: 1.6 }}>Save and restart router if needed</li>
        </ol>
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "var(--bg-elev2)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Firewall (Linux/VPS)</div>
          <div style={{ color: "var(--text-dim)", fontSize: 13 }}>
            <code style={{ fontFamily: "var(--mono)" }}>ufw allow {info?.port ?? 25565}/tcp</code>
          </div>
        </div>
      </details>
    </>
  );
}
