"use client";

import { useEffect, useState, useCallback } from "react";

interface Player {
  uuid: string;
  name: string;
  avatar: string | null;
  online: boolean;
  health: number | null;
  foodLevel: number | null;
  xpLevel: number | null;
  position: { x: number; y: number; z: number; dimension: string } | null;
  death: { x: number; y: number; z: number; dimension: string } | null;
  inventoryCount: number;
  lastModified: string | null;
}
interface InvItem {
  slot: number;
  id: string;
  count: number;
}

function dimName(d: string): string {
  return d.replace("minecraft:", "").replace("the_", "").replace(/_/g, " ");
}
function itemName(id: string): string {
  return id.replace("minecraft:", "").replace(/_/g, " ");
}

function InventoryPanel({ uuid }: { uuid: string }) {
  const [items, setItems] = useState<InvItem[] | null>(null);
  const [ender, setEnder] = useState<InvItem[]>([]);
  useEffect(() => {
    fetch(`/api/players/${uuid}/inventory`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setItems(d.inventory || []);
          setEnder(d.enderItems || []);
        } else setItems([]);
      });
  }, [uuid]);

  if (items === null)
    return <div style={{ color: "var(--text-dim)", marginTop: 10 }}>Loading…</div>;
  if (items.length === 0 && ender.length === 0)
    return (
      <div style={{ color: "var(--text-dim)", marginTop: 10 }}>Inventory empty</div>
    );

  const render = (label: string, list: InvItem[]) =>
    list.length > 0 && (
      <div style={{ marginTop: 12 }}>
        <div className="stat label" style={{ marginBottom: 6 }}>
          {label}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 6,
          }}
        >
          {list
            .slice()
            .sort((a, b) => a.slot - b.slot)
            .map((it, i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-elev2)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "6px 10px",
                  fontSize: 12.5,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ textTransform: "capitalize" }}>
                  {itemName(it.id)}
                </span>
                <span style={{ color: "var(--accent)", fontWeight: 700 }}>
                  ×{it.count}
                </span>
              </div>
            ))}
        </div>
      </div>
    );

  return (
    <>
      {render("Inventory", items)}
      {render("Ender Chest", ender)}
    </>
  );
}

function ActionMenu({
  name,
  online,
  onDone,
}: {
  name: string;
  online: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function act(action: string, reason?: string) {
    setBusy(true);
    setMsg("");
    const r = await fetch(`/api/players/${name}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const d = await r.json();
    setBusy(false);
    if (r.ok) {
      setMsg(d.output || "Done ✓");
      onDone();
    } else {
      setMsg(d.error || "Failed");
    }
  }

  async function kick() {
    const reason = prompt(`Kick reason for ${name} (optional):`);
    if (reason === null) return;
    await act("kick", reason || undefined);
  }
  async function ban() {
    const reason = prompt(`Ban reason for ${name} (optional):`);
    if (reason === null) return;
    await act("ban", reason || undefined);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn-ghost"
        style={{ padding: "6px 12px", fontSize: 13 }}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        Actions ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            background: "var(--bg-elev)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            minWidth: 160,
            zIndex: 100,
            boxShadow: "0 4px 20px rgba(0,0,0,.4)",
            overflow: "hidden",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {online && (
            <>
              <ActionItem label="Kick" onClick={() => { setOpen(false); kick(); }} />
              <ActionItem label="Set Survival" onClick={() => { setOpen(false); act("gamemode", "survival"); }} />
              <ActionItem label="Set Creative" onClick={() => { setOpen(false); act("gamemode", "creative"); }} />
              <ActionItem label="Set Spectator" onClick={() => { setOpen(false); act("gamemode", "spectator"); }} />
            </>
          )}
          <ActionItem label="Op" onClick={() => { setOpen(false); act("op"); }} />
          <ActionItem label="Deop" onClick={() => { setOpen(false); act("deop"); }} />
          <ActionItem label="Ban" danger onClick={() => { setOpen(false); ban(); }} />
          <ActionItem label="Pardon" onClick={() => { setOpen(false); act("pardon"); }} />
        </div>
      )}
      {msg && (
        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: msg.includes("✓") || msg.includes("Done") ? "var(--accent)" : "var(--danger)",
          }}
        >
          {msg}
        </div>
      )}
    </div>
  );
}

function ActionItem({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderRadius: 0,
        padding: "10px 16px",
        color: danger ? "var(--danger)" : "var(--text)",
        fontSize: 13,
        cursor: "pointer",
      }}
      onMouseEnter={(e) =>
        ((e.target as HTMLElement).style.background = "var(--bg-elev2)")
      }
      onMouseLeave={(e) =>
        ((e.target as HTMLElement).style.background = "none")
      }
    >
      {label}
    </button>
  );
}

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/players");
    if (r.ok) {
      const d = await r.json();
      setPlayers(d.players);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <>
      <div className="page-title">Players</div>
      <div className="page-sub">
        {players.filter((p) => p.online).length} online · {players.length} total · click to expand inventory &amp; stats
      </div>

      {loading && <div style={{ color: "var(--text-dim)" }}>Loading…</div>}
      {!loading && players.length === 0 && (
        <div className="card" style={{ color: "var(--text-dim)" }}>
          No player data yet. Players appear here after they join the world once.
        </div>
      )}

      <div className="grid" style={{ gap: 12 }}>
        {players.map((p) => (
          <div key={p.uuid} className="card">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, cursor: "pointer" }}
                onClick={() => setOpen(open === p.uuid ? null : p.uuid)}
              >
                {p.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar}
                    alt={p.name}
                    width={42}
                    height={42}
                    style={{ borderRadius: 6, imageRendering: "pixelated" }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                  <div style={{ color: "var(--text-dim)", fontSize: 12.5 }}>
                    {p.health != null && `❤ ${p.health}  `}
                    {p.foodLevel != null && `🍖 ${p.foodLevel}  `}
                    {p.xpLevel != null && `✦ lvl ${p.xpLevel}  `}
                    {p.inventoryCount > 0 && `🎒 ${p.inventoryCount} items`}
                  </div>
                </div>
                <span
                  className={`badge ${p.online ? "badge-online" : "badge-offline"}`}
                >
                  <span className="dot" />
                  {p.online ? "Online" : "Offline"}
                </span>
              </div>
              <ActionMenu name={p.name} online={p.online} onDone={refresh} />
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 24, flexWrap: "wrap" }}>
              {p.position && (
                <div className="stat">
                  <span className="label">Location</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                    {p.position.x}, {p.position.y}, {p.position.z}{" "}
                    <span style={{ color: "var(--text-dim)" }}>
                      ({dimName(p.position.dimension)})
                    </span>
                  </span>
                </div>
              )}
              {p.death && (
                <div className="stat">
                  <span className="label">Last Death</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
                    {p.death.x}, {p.death.y}, {p.death.z}{" "}
                    <span style={{ color: "var(--text-dim)" }}>
                      ({dimName(p.death.dimension)})
                    </span>
                  </span>
                </div>
              )}
              {p.lastModified && (
                <div className="stat">
                  <span className="label">Last Seen</span>
                  <span style={{ fontSize: 13 }}>
                    {new Date(p.lastModified).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            {open === p.uuid && <InventoryPanel uuid={p.uuid} />}
          </div>
        ))}
      </div>
    </>
  );
}
