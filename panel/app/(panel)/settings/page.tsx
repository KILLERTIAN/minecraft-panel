"use client";

import { useEffect, useState } from "react";

interface Props {
  properties: Record<string, string>;
}

const FIELD_META: Record<string, { label: string; type: "text" | "select" | "bool" | "number"; options?: string[] }> = {
  motd: { label: "Server MOTD", type: "text" },
  "max-players": { label: "Max Players", type: "number" },
  difficulty: { label: "Difficulty", type: "select", options: ["peaceful", "easy", "normal", "hard"] },
  gamemode: { label: "Default Gamemode", type: "select", options: ["survival", "creative", "adventure", "spectator"] },
  hardcore: { label: "Hardcore Mode", type: "bool" },
  pvp: { label: "PvP", type: "bool" },
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
  "white-list": { label: "Whitelist (allow only listed players)", type: "bool" },
  "enforce-whitelist": { label: "Enforce Whitelist (kick non-listed)", type: "bool" },
};

export default function SettingsPage() {
  const [props, setProps] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/server/properties")
      .then((r) => r.json())
      .then((d) => {
        setProps(d.properties);
        setPending(d.properties);
      });
  }, []);

  function change(key: string, val: string) {
    setPending((p) => ({ ...p, [key]: val }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg("");
    const r = await fetch("/api/server/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties: pending }),
    });
    setSaving(false);
    if (r.ok) {
      setProps(pending);
      setMsg("Saved. Restart server to apply changes.");
    } else {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Save failed");
    }
  }

  const isDirty = JSON.stringify(props) !== JSON.stringify(pending);

  return (
    <>
      <div className="page-title">Server Settings</div>
      <div className="page-sub">
        Edit server.properties — restart required to apply
      </div>

      <form onSubmit={save}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {Object.keys(FIELD_META).map((key) => {
              const meta = FIELD_META[key];
              const val = pending[key] ?? "";
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600 }}>
                    {meta.label}
                  </label>
                  {meta.type === "bool" ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      {["true", "false"].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => change(key, opt)}
                          className={val === opt ? "btn-primary" : "btn-ghost"}
                          style={{ flex: 1, padding: "8px 12px" }}
                        >
                          {opt === "true" ? "On" : "Off"}
                        </button>
                      ))}
                    </div>
                  ) : meta.type === "select" ? (
                    <select
                      value={val}
                      onChange={(e) => change(key, e.target.value)}
                      style={{
                        background: "var(--bg-elev2)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        borderRadius: "var(--radius)",
                        padding: "10px 12px",
                        fontSize: 14,
                      }}
                    >
                      {meta.options!.map((o) => (
                        <option key={o} value={o}>
                          {o.charAt(0).toUpperCase() + o.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={meta.type === "number" ? "number" : "text"}
                      value={val}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {msg && (
          <div
            style={{
              marginBottom: 12,
              fontSize: 13,
              color: msg.includes("Saved") ? "var(--accent)" : "var(--danger)",
            }}
          >
            {msg}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary"
          disabled={!isDirty || saving}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {isDirty && (
          <button
            type="button"
            className="btn-ghost"
            style={{ marginLeft: 12 }}
            onClick={() => setPending(props)}
          >
            Discard
          </button>
        )}
      </form>
    </>
  );
}
