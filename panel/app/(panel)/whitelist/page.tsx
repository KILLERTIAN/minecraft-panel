"use client";

import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, UserPlus, Trash2, Users, Check, AlertCircle, Loader2 } from "lucide-react";

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
  const [msgOk, setMsgOk] = useState(true);
  const [serverAddress, setServerAddress] = useState("");

  const refresh = useCallback(async () => {
    const r = await fetch("/api/whitelist");
    if (r.ok) setEntries((await r.json()).entries);
    const s = await fetch("/api/server/status");
    if (s.ok) setServerAddress((await s.json()).serverAddress);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    setMsgOk(r.ok);
    if (r.ok) {
      setName("");
      setMsg(`Added ${name.trim()} to whitelist`);
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
    else { setMsgOk(false); setMsg((await r.json()).error || "Failed to remove"); }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Whitelist</h1>
        <p className="page-sub">Only whitelisted players can join your server</p>
      </div>

      {/* Server address */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <ShieldCheck size={15} color="var(--accent)" />
          <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-dim)" }}>
            Server Address
          </div>
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
          {serverAddress || "—"}
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 6 }}>
          Share in Minecraft → Multiplayer → Add Server
        </div>
      </div>

      {/* Add player */}
      <form onSubmit={add} className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--accent-dim)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserPlus size={16} color="var(--accent)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>Add Friend</div>
            <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>Enter their exact Minecraft username</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            placeholder="e.g. Notch, Steve, Alex…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn-primary" disabled={busy || !name.trim()} style={{ flexShrink: 0 }}>
            {busy ? <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} /> : <UserPlus size={15} />}
            {busy ? "Adding…" : "Add"}
          </button>
        </div>
        {msg && (
          <div style={{ marginTop: 10, fontSize: 13, color: msgOk ? "var(--accent)" : "var(--danger)", display: "flex", alignItems: "center", gap: 6 }}>
            {msgOk ? <Check size={13} /> : <AlertCircle size={13} />}
            {msg}
          </div>
        )}
        <div style={{ color: "var(--text-dim)", fontSize: 12, marginTop: 8 }}>
          Server must be online to update the whitelist via RCON.
        </div>
      </form>

      {/* List */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Users size={15} color="var(--text-dim)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-mid)" }}>
            Whitelisted Players
          </span>
          <span className="chip" style={{ marginLeft: 4 }}>{entries.length}</span>
        </div>

        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-dim)", fontSize: 13 }}>
            <ShieldCheck size={28} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
            No players whitelisted yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {entries.map((e, i) => (
              <div
                key={e.uuid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 0",
                  borderBottom: i < entries.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={e.avatar}
                  alt={e.name}
                  width={36}
                  height={36}
                  style={{ borderRadius: 7, imageRendering: "pixelated", border: "1px solid var(--border)" }}
                />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{e.name}</span>
                <button
                  className="btn-icon"
                  onClick={() => remove(e.name)}
                  title={`Remove ${e.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
