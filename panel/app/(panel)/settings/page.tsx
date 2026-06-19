"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, Zap, Save, RotateCcw, Timer, Check, AlertCircle, Package, AlertTriangle } from "lucide-react";

const FIELD_META: Record<string, {
  label: string;
  type: "text" | "select" | "bool" | "number";
  options?: string[];
  live?: boolean;
  desc?: string;
}> = {
  motd: { label: "Server MOTD", type: "text", desc: "Message shown in server list" },
  "max-players": { label: "Max Players", type: "number", live: true, desc: "Maximum concurrent players" },
  difficulty: { label: "Difficulty", type: "select", options: ["peaceful", "easy", "normal", "hard"], live: true },
  gamemode: { label: "Default Gamemode", type: "select", options: ["survival", "creative", "adventure", "spectator"], live: true },
  hardcore: { label: "Hardcore Mode", type: "bool", desc: "Players are banned on death" },
  pvp: { label: "PvP", type: "bool", live: true, desc: "Player vs player combat" },
  "allow-flight": { label: "Allow Flight", type: "bool" },
  "allow-nether": { label: "Allow Nether", type: "bool" },
  "enable-command-block": { label: "Command Blocks", type: "bool" },
  "force-gamemode": { label: "Force Gamemode on Join", type: "bool" },
  "online-mode": { label: "Online Mode (auth)", type: "bool", desc: "Requires Mojang auth" },
  "player-idle-timeout": { label: "Idle Timeout (min)", type: "number", desc: "0 = disabled" },
  "spawn-protection": { label: "Spawn Protection Radius", type: "number" },
  "view-distance": { label: "View Distance (chunks)", type: "number" },
  "simulation-distance": { label: "Simulation Distance", type: "number" },
  "spawn-animals": { label: "Spawn Animals", type: "bool" },
  "spawn-monsters": { label: "Spawn Monsters", type: "bool" },
  "spawn-npcs": { label: "Spawn Villagers", type: "bool" },
  "generate-structures": { label: "Generate Structures", type: "bool" },
  "white-list": { label: "Whitelist", type: "bool", live: true },
  "enforce-whitelist": { label: "Enforce Whitelist", type: "bool", live: true },
};

function FieldInput({
  fieldKey,
  meta,
  value,
  onChange,
}: {
  fieldKey: string;
  meta: typeof FIELD_META[string];
  value: string;
  onChange: (v: string) => void;
}) {
  if (meta.type === "bool") {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        {(["true", "false"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${value === opt ? (opt === "true" ? "var(--accent)" : "var(--border)") : "var(--border)"}`,
              background: value === opt
                ? opt === "true" ? "var(--accent-dim)" : "var(--bg-elev2)"
                : "var(--bg-elev2)",
              color: value === opt
                ? opt === "true" ? "var(--accent)" : "var(--text)"
                : "var(--text-dim)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all var(--transition)",
            }}
          >
            {opt === "true" ? "On" : "Off"}
          </button>
        ))}
      </div>
    );
  }
  if (meta.type === "select") {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {meta.options!.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={meta.type === "number" ? "number" : "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

const FABRIC_LIKE = ["FABRIC", "QUILT"];

function VersionCard() {
  const [info, setInfo] = useState<{ type: string; version: string; loaderVersion: string | null; types: string[] } | null>(null);
  const [type, setType] = useState("");
  const [version, setVersion] = useState("");
  const [loaderVersion, setLoaderVersion] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  useEffect(() => {
    fetch("/api/server/version")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setMsg(d.error); setMsgType("err"); return; }
        setInfo(d);
        setType(d.type);
        setVersion(d.version);
        setLoaderVersion(d.loaderVersion || "");
      })
      .catch((e) => { setMsg(String(e)); setMsgType("err"); });
  }, []);

  const dirty = info && (type !== info.type || version !== info.version || (FABRIC_LIKE.includes(type) && loaderVersion !== (info.loaderVersion || "")));

  async function apply() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/server/version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, version, loaderVersion: FABRIC_LIKE.includes(type) ? loaderVersion : null }),
      });
      const d = await r.json();
      if (!r.ok) { setMsg(d.error || "Failed"); setMsgType("err"); setBusy(false); return; }
      setMsgType("ok");
      setMsg(`Applied ${d.type} ${d.version} · backup #${d.backupId} taken first. ${d.note || ""}`);
      setInfo((p) => p && { ...p, type: d.type, version: d.version, loaderVersion: d.loaderVersion });
      setConfirm(false);
    } catch (e: any) {
      setMsg(e?.message || "Failed"); setMsgType("err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
        <div style={{ width: 38, height: 38, background: "var(--accent-dim)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Package size={18} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>Server Version</div>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
            {info ? <>Currently <b>{info.type} {info.version}</b>{info.loaderVersion ? ` (loader ${info.loaderVersion})` : ""}</> : "Loading…"}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <label style={{ fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} disabled={!info}>
            {info?.types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <label style={{ fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Version</label>
          <input type="text" value={version} placeholder="26.2 or LATEST" onChange={(e) => setVersion(e.target.value)} disabled={!info} />
        </div>
        {FABRIC_LIKE.includes(type) && (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{ fontSize: 11.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>Loader Version</label>
            <input type="text" value={loaderVersion} placeholder="e.g. 0.19.3" onChange={(e) => setLoaderVersion(e.target.value)} disabled={!info} />
          </div>
        )}
      </div>

      {dirty && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", borderRadius: "var(--radius-sm)", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", marginBottom: 14 }}>
          <AlertTriangle size={16} color="var(--warn)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>
            Changing version recreates the server container. A world backup is taken first automatically.
            World upgrades are <b>one-way</b> — you can't open an upgraded world in an older version.
            Switching mod loaders (e.g. Fabric → Vanilla) drops all mods.
            <label style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} style={{ width: "auto" }} />
              I understand, back up and proceed
            </label>
          </div>
        </div>
      )}

      <button className="btn-primary" onClick={apply} disabled={!dirty || !confirm || busy} type="button">
        {busy ? (
          <>
            <span style={{ width: 15, height: 15, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            Backing up & recreating…
          </>
        ) : (
          <><Package size={14} /> Apply Version</>
        )}
      </button>

      {msg && (
        <div style={{ marginTop: 12, fontSize: 13, color: msgType === "err" ? "var(--danger)" : "var(--accent)", display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.5 }}>
          {msgType === "ok" ? <Check size={14} style={{ flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />}
          <span>{msg}</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [props, setProps] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
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

    const changed: Record<string, string> = {};
    for (const k of Object.keys(pending)) {
      if (pending[k] !== props[k]) changed[k] = pending[k];
    }

    const r = await fetch("/api/server/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ properties: pending }),
    });

    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setMsg(d.error || "Save failed");
      setMsgType("err");
      setSaving(false);
      return;
    }

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
    setMsgType("ok");

    const needsRestart = Object.keys(changed).some((k) => !liveApplied.includes(k));
    if (liveApplied.length > 0 && !needsRestart) {
      setMsg(`Applied live: ${liveApplied.join(", ")} — no restart needed`);
    } else if (liveApplied.length > 0) {
      setMsg(`Applied live: ${liveApplied.join(", ")} · Other changes need restart`);
    } else {
      setMsg("Saved · Restart server to apply changes");
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
      setIdleMsg(idleMinutes > 0 ? `Auto-shutdown after ${idleMinutes} min idle` : "Auto-shutdown disabled");
    } else {
      setIdleMsg("Failed to save");
    }
  }

  const isDirty = JSON.stringify(props) !== JSON.stringify(pending);
  const liveCount = Object.keys(FIELD_META).filter((k) => FIELD_META[k].live).length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          Server configuration ·{" "}
          <span style={{ color: "var(--accent)", display: "inline-flex", alignItems: "center", gap: 4 }}>
            <Zap size={12} />
            {liveCount} settings apply instantly via RCON
          </span>
        </p>
      </div>

      <form onSubmit={save}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {Object.keys(FIELD_META).map((key) => {
              const meta = FIELD_META[key];
              const val = pending[key] ?? "";
              const changed = val !== props[key];
              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <label style={{
                    fontSize: 11.5,
                    color: "var(--text-dim)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    fontWeight: 700,
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                  }}>
                    {meta.label}
                    {meta.live && (
                      <span className="chip chip-accent" style={{ fontSize: 10 }}>
                        <Zap size={9} />
                        Live
                      </span>
                    )}
                    {changed && (
                      <span className="chip" style={{ fontSize: 10, background: "rgba(245,166,35,0.1)", borderColor: "rgba(245,166,35,0.2)", color: "var(--warn)" }}>
                        Modified
                      </span>
                    )}
                  </label>
                  <FieldInput fieldKey={key} meta={meta} value={val} onChange={(v) => change(key, v)} />
                  {meta.desc && (
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{meta.desc}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {msg && (
          <div style={{
            marginBottom: 14,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 7,
            color: msgType === "err" ? "var(--danger)" : "var(--accent)",
          }}>
            {msgType === "ok" ? <Check size={14} /> : <AlertCircle size={14} />}
            {msg}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn-primary" disabled={!isDirty || saving}>
            {saving ? (
              <>
                <span style={{ width: 15, height: 15, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                Saving…
              </>
            ) : (
              <>
                <Save size={15} />
                Save Changes
              </>
            )}
          </button>
          {isDirty && (
            <button type="button" className="btn-ghost" onClick={() => setPending(props)}>
              <RotateCcw size={14} />
              Discard
            </button>
          )}
        </div>
      </form>

      {/* Auto-Shutdown */}
      <div className="card" style={{ marginTop: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 38, height: 38, background: "rgba(245,166,35,0.1)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Timer size={18} color="var(--warn)" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>Auto-Shutdown</div>
            <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 2 }}>
              Stop server automatically when no players are online. Set 0 to disable.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-elev2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "8px 14px", width: 160 }}>
            <input
              type="number"
              min={0}
              max={1440}
              value={idleMinutes}
              onChange={(e) => setIdleMinutes(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                width: 60,
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text)",
              }}
            />
            <span style={{ color: "var(--text-dim)", fontSize: 13 }}>min</span>
          </div>
          <button className="btn-primary" onClick={saveIdle} disabled={idleSaving} type="button">
            <Check size={14} />
            {idleSaving ? "Saving…" : "Apply"}
          </button>
        </div>
        {idleMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--accent)", display: "flex", alignItems: "center", gap: 6 }}>
            <Check size={13} />
            {idleMsg}
          </div>
        )}
      </div>

      <VersionCard />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
