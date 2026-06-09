"use client";

import { useEffect, useState, useCallback } from "react";

interface Entry {
  uuid: string;
  name: string;
  avatar: string;
}

export default function WhitelistPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [serverAddress, setServerAddress] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/whitelist");
    if (r.ok) setEntries((await r.json()).entries);
    const s = await fetch("/api/server/status");
    if (s.ok) setServerAddress((await s.json()).serverAddress);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      setName("");
      setMsg(`Added ${name.trim()} ✓`);
      refresh();
    } else {
      setMsg(d.error || "Failed to add");
    }
  }

  async function remove(n: string) {
    if (!confirm(`Remove ${n} from whitelist?`)) return;
    const r = await fetch("/api/whitelist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    if (r.ok) refresh();
    else setMsg((await r.json()).error || "Failed to remove");
  }

  return (
    <>
      <div className="page-title">Whitelist · Invite Friends</div>
      <div className="page-sub">
        Only whitelisted players can join. Share your server address with them.
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="stat label" style={{ marginBottom: 6 }}>
          Server address
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700 }}>
          {serverAddress || "…"}
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 6 }}>
          Friends add this in Minecraft → Multiplayer → Add Server.
        </div>
      </div>

      <form onSubmit={add} className="card" style={{ marginBottom: 16 }}>
        <div className="stat label" style={{ marginBottom: 8 }}>
          Add a friend by Minecraft username
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="e.g. Notch"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        {msg && (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: msg.includes("✓") ? "var(--accent)" : "var(--danger)",
            }}
          >
            {msg}
          </div>
        )}
        <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>
          Note: server must be online to update the whitelist.
        </div>
      </form>

      <div className="card">
        <div className="stat label" style={{ marginBottom: 12 }}>
          Whitelisted ({entries.length})
        </div>
        {entries.length === 0 ? (
          <div style={{ color: "var(--text-dim)" }}>Nobody whitelisted yet.</div>
        ) : (
          <div className="grid" style={{ gap: 8 }}>
            {entries.map((e) => (
              <div
                key={e.uuid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 4px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.avatar}
                  alt={e.name}
                  width={32}
                  height={32}
                  style={{ borderRadius: 5, imageRendering: "pixelated" }}
                />
                <span style={{ flex: 1, fontWeight: 600 }}>{e.name}</span>
                <button className="btn-ghost" onClick={() => remove(e.name)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
