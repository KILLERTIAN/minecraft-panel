"use client";

import { useEffect, useState } from "react";

const FIELD_META: Record<string, { label: string; type: "text" | "select" | "bool" | "number"; options?: string[]; live?: boolean }> = {
  motd: { label: "Server MOTD", type: "text" },
  "max-players": { label: "Max Players", type: "number", live: true },
  difficulty: { label: "Difficulty", type: "select", options: ["peaceful", "easy", "normal", "hard"], live: true },
  gamemode: { label: "Default Gamemode", type: "select", options: ["survival", "creative", "adventure", "spectator"], live: true },
  hardcore: { label: "Hardcore Mode", type: "bool" },
  pvp: { label: "PvP", type: "bool", live: true },
  "allow-flight": { label: "Allow Flight", type: "bool" },
  "allow-nether": { label: "Allow Nether", type: "bool" },
  "enable-command-block": { label: "Command Blocks", type: "bool" },
  "force-gamemode": { label: "Force Gamemode on Join", type: "bool" },
  "online-mode": { label: "Online Mode (auth)", type: "bool" },
  "player-idle-timeout": { label: "Idle Timeout (min, 0=off)", type: "number" },
  "spawn-protection": { label: "Spawn Protection Radius", type: "number" },
  "view-distance": { label: "View Distance (chunks)", type: "number" },
  "simulation-distance": { label: "Simulation Distance (chunks)", type: "number" },
  "spawn-animals": { label: "Spawn Animals", type: "bool" },
  "spawn-monsters": { label: "Spawn Monsters", type: "bool" },
  "spawn-npcs": { label: "Spawn Villagers", type: "bool" },
  "generate-structures": { label: "Generate Structures", type: "bool" },
  "white-list": { label: "Whitelist", type: "bool", live: true },
  "enforce-whitelist": { label: "Enforce Whitelist", type: "bool", live: true },
};

export default function SettingsPage() {
  const [props, setProps] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [idleMinutes, setIdleMinutes] = useState(0);
  const [idleSaving, setIdleSaving] = useState(false);
  const [idleMsg, setIdleMsg] = useState("");

  useEffect(() => {
    fetch("/api/server/properties")
      .then((r) => r.json())
      .then((d) => { setProps(d.properties); setPending(d.properties); });
    fetch("/api/server/idle-shutdown")
      .then((r) => r.json())
      .then((d) => setIdleMinutes(d.minutes || 0));
  }, []);

  function change(key: string, val: string) {
    setPending((p) => ({ ...p, [key]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");

    // Find changed keys
    const changed: Record<string, string> = {};
    for (const k of Object.keys(pending)) {
      if (pending[k] !== props[k]) changed[k] = pending[k];
    }

    // Save to file
    const r = await fetch("/api/server/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties: pending }),
    });

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Save failed");
      setSaving(false);
      return;
    }

    // Try live-apply changed live-capable keys
    const liveKeys = Object.keys(changed).filter((k) => FIELD_META[k]?.live);
    let liveApplied: string[] = [];
    if (liveKeys.length > 0) {
      const liveProps: Record<string, string> = {};
      for (const k of liveKeys) liveProps[k] = changed[k];
      const lr = await fetch("/api/server/properties/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ properties: liveProps }),
      }).then((r) => r.json()).catch(() => ({ applied: [] }));
      liveApplied = lr.applied || [];
    }

    setProps(pending);
    setSaving(false);

    const needsRestart = Object.keys(changed).some((k) => !liveApplied.includes(k));
    if (liveApplied.length > 0 && !needsRestart) {
      setMsg(`Applied live: ${liveApplied.join(", ")} — no restart needed.`);
    } else if (liveApplied.length > 0) {
      setMsg(`Applied live: ${liveApplied.join(", ")}. Other changes need server restart.`);
    } else {
      setMsg("Saved. Restart server to apply changes.");
    }
  }

  async function saveIdle() {
    setIdleSaving(true);
    setIdleMsg("");
    const r = await fetch("/api/server/idle-shutdown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes: idleMinutes }),
    });
    setIdleSaving(false);
    if (r.ok) {
      setIdleMsg(idleMinutes > 0 ? `Auto-shutdown after ${idleMinutes} min idle.` : "Auto-shutdown disabled.");
    } else {
      setIdleMsg("Failed to save.");
    }
  }

  const isDirty = JSON.stringify(props) !== JSON.stringify(pending);

  return (
    <>
      <div className="page-title">Server Settings</div>
      <div className="page-sub">
        Settings marked <span style={{ color: "var(--accent)" }}>⚡ Live</span> apply instantly via RCON. Others require restart.
      </div>

      <form onSubmit={save}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {Object.keys(FIELD_META).map((key) => {
              const meta = FIELD_META[key];
              const val = pending[key] ?? "";
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
                    {meta.label}
                    {meta.live && <span style={{ color: "var(--accent)", fontSize: 10 }}>⚡ Live</span>}
                  </label>
                  {meta.type === "bool" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      {["true", "false"].map((opt) => (
                        <button key={opt} type="button" onClick={() => change(key, opt)}
                          className={val === opt ? "btn-primary" : "btn-ghost"}
                          style={{ flex: 1, padding: "8px 12px" }}>
                          {opt === "true" ? "On" : "Off"}
                        </button>
                      ))}
                    </div>
                  ) : meta.type === "select" ? (
                    <select value={val} onChange={(e) => change(key, e.target.value)}
                      style={{ background: "var(--bg-elev2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 14 }}>
                      {meta.options!.map((o) => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                  ) : (
                    <input type={meta.type === "number" ? "number" : "text"} value={val}
                      onChange={(e) => change(key, e.target.value)} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {msg && (
          <div style={{ marginBottom: 12, fontSize: 13, color: msg.includes("failed") || msg.includes("Failed") ? "var(--danger)" : "var(--accent)" }}>
            {msg}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={!isDirty || saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {isDirty && (
          <button type="button" className="btn-ghost" style={{ marginLeft: 12 }} onClick={() => setPending(props)}>
            Discard
          </button>
        )}
      </form>

      {/* Auto-shutdown */}
      <div className="card" style={{ marginTop: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Auto-Shutdown</div>
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
          Automatically stop server when no players online for N minutes. Set 0 to disable.
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input
            type="number"
            min={0}
            max={1440}
            value={idleMinutes}
            onChange={(e) => setIdleMinutes(Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: 100 }}
          />
          <span style={{ color: "var(--text-dim)", fontSize: 13 }}>minutes</span>
          <button className="btn-primary" onClick={saveIdle} disabled={idleSaving}>
            {idleSaving ? "Saving…" : "Apply"}
          </button>
        </div>
        {idleMsg && (
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--accent)" }}>{idleMsg}</div>
        )}
      </div>
    </>
  );
}
