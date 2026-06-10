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

// Minecraft slot layout:
// Slots 0-8: hotbar
// Slots 9-35: main inventory (rows 1-3)
// Slots 36-39: armor (head/chest/legs/feet)
// Slots 40: offhand
// Ender chest: slots 0-26

const SLOT_SIZE = 44;
const SLOT_STYLE: React.CSSProperties = {
  width: SLOT_SIZE,
  height: SLOT_SIZE,
  background: "rgba(0,0,0,0.35)",
  border: "2px solid rgba(255,255,255,0.12)",
  borderRadius: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  fontSize: 10,
  flexShrink: 0,
};

function SlotCell({ item, title }: { item?: InvItem; title?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...SLOT_STYLE, borderColor: hovered && item ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.12)", cursor: item ? "default" : undefined }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={item ? `${itemName(item.id)} ×${item.count}` : title || ""}
    >
      {item ? (
        <>
          <span style={{ fontSize: 20 }}>{itemEmoji(item.id)}</span>
          {item.count > 1 && (
            <span style={{ position: "absolute", bottom: 2, right: 4, fontSize: 10, fontWeight: 700, color: "#fff", textShadow: "1px 1px 0 #000" }}>
              {item.count}
            </span>
          )}
          {hovered && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)",
              background: "#1a1a2e", border: "1px solid var(--border)", borderRadius: 6,
              padding: "4px 8px", fontSize: 11, whiteSpace: "nowrap", zIndex: 200,
              color: "var(--text)", pointerEvents: "none",
              textTransform: "capitalize",
            }}>
              {itemName(item.id)}
              {item.count > 1 && <span style={{ color: "var(--accent)", marginLeft: 4 }}>×{item.count}</span>}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function itemEmoji(id: string): string {
  const n = id.replace("minecraft:", "");
  const map: Record<string, string> = {
    diamond_sword: "⚔️", iron_sword: "⚔️", stone_sword: "⚔️", wooden_sword: "⚔️", golden_sword: "⚔️", netherite_sword: "⚔️",
    bow: "🏹", crossbow: "🏹", arrow: "🏹", tipped_arrow: "🏹",
    diamond_pickaxe: "⛏️", iron_pickaxe: "⛏️", stone_pickaxe: "⛏️", wooden_pickaxe: "⛏️", golden_pickaxe: "⛏️", netherite_pickaxe: "⛏️",
    diamond_axe: "🪓", iron_axe: "🪓", stone_axe: "🪓", wooden_axe: "🪓", golden_axe: "🪓", netherite_axe: "🪓",
    diamond_shovel: "🪏", iron_shovel: "🪏", stone_shovel: "🪏", wooden_shovel: "🪏",
    diamond_helmet: "⛑️", iron_helmet: "⛑️", leather_helmet: "⛑️", netherite_helmet: "⛑️", golden_helmet: "⛑️",
    diamond_chestplate: "🦺", iron_chestplate: "🦺", leather_chestplate: "🦺", netherite_chestplate: "🦺",
    diamond_leggings: "👖", iron_leggings: "👖", leather_leggings: "👖", netherite_leggings: "👖",
    diamond_boots: "👟", iron_boots: "👟", leather_boots: "👟", netherite_boots: "👟",
    apple: "🍎", golden_apple: "🍎", enchanted_golden_apple: "🍎",
    bread: "🍞", cooked_beef: "🥩", cooked_porkchop: "🥩", cooked_chicken: "🍗",
    beef: "🥩", porkchop: "🥩", chicken: "🍗",
    torch: "🔦", lantern: "🏮", soul_lantern: "🏮",
    dirt: "🟫", grass_block: "🟩", stone: "🪨", cobblestone: "🪨", gravel: "⬜",
    sand: "🟡", sandstone: "🟡", glass: "🪟",
    wood: "🪵", oak_log: "🪵", birch_log: "🪵", spruce_log: "🪵", jungle_log: "🪵",
    oak_planks: "🟫", birch_planks: "🟫",
    chest: "📦", barrel: "📦", shulker_box: "📦",
    book: "📖", enchanted_book: "📖", writable_book: "📖",
    map: "🗺️", filled_map: "🗺️",
    compass: "🧭", clock: "🕐",
    fishing_rod: "🎣",
    flint_and_steel: "🔥",
    ender_pearl: "🟢", eye_of_ender: "🟢",
    diamond: "💎", emerald: "💚", gold_ingot: "🟡", iron_ingot: "⬜",
    coal: "⬛", redstone: "🔴", lapis_lazuli: "🔵",
    blaze_rod: "🔥", blaze_powder: "🔥",
    string: "🧵", feather: "🪶", leather: "🟤",
    bone: "🦴", bone_meal: "⬜",
    gunpowder: "💥", tnt: "💥",
    saddle: "🐴", lead: "🪢",
    shield: "🛡️",
    totem_of_undying: "🗿",
    potion: "🧪", splash_potion: "🧪", lingering_potion: "🧪",
    glass_bottle: "🍶",
    bucket: "🪣", water_bucket: "🪣", lava_bucket: "🪣", milk_bucket: "🪣",
    snowball: "❄️", snow_block: "❄️",
    egg: "🥚",
    nether_star: "⭐", beacon: "⭐",
  };
  if (map[n]) return map[n];
  if (n.includes("sword")) return "⚔️";
  if (n.includes("pickaxe")) return "⛏️";
  if (n.includes("axe")) return "🪓";
  if (n.includes("helmet") || n.includes("cap")) return "⛑️";
  if (n.includes("chestplate") || n.includes("tunic")) return "🦺";
  if (n.includes("leggings") || n.includes("pants")) return "👖";
  if (n.includes("boots")) return "👟";
  if (n.includes("log") || n.includes("wood") || n.includes("plank")) return "🪵";
  if (n.includes("stone") || n.includes("rock")) return "🪨";
  if (n.includes("ore")) return "💎";
  if (n.includes("potion")) return "🧪";
  if (n.includes("food") || n.includes("stew") || n.includes("soup")) return "🍲";
  return "📦";
}

function InventoryGrid({ items, slots, cols, label }: { items: InvItem[]; slots: number[]; cols: number; label: string }) {
  const bySlot = new Map(items.map((it) => [it.slot, it]));
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${SLOT_SIZE}px)`, gap: 3 }}>
        {slots.map((s) => <SlotCell key={s} item={bySlot.get(s)} />)}
      </div>
    </div>
  );
}

function InventoryPanel({ uuid }: { uuid: string }) {
  const [items, setItems] = useState<InvItem[] | null>(null);
  const [ender, setEnder] = useState<InvItem[]>([]);
  useEffect(() => {
    fetch(`/api/players/${uuid}/inventory`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) { setItems(d.inventory || []); setEnder(d.enderItems || []); }
        else setItems([]);
      });
  }, [uuid]);

  if (items === null) return <div style={{ color: "var(--text-dim)", marginTop: 10 }}>Loading…</div>;
  if (items.length === 0 && ender.length === 0)
    return <div style={{ color: "var(--text-dim)", marginTop: 10 }}>Inventory empty</div>;

  // Minecraft slot layout
  const mainSlots = Array.from({ length: 27 }, (_, i) => i + 9); // 9-35
  const hotbarSlots = Array.from({ length: 9 }, (_, i) => i);    // 0-8
  const armorSlots = [36, 37, 38, 39];                            // head→feet
  const offhandSlot = [40];
  const enderSlots = Array.from({ length: 27 }, (_, i) => i);

  return (
    <div style={{ marginTop: 16, overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <InventoryGrid items={items} slots={armorSlots} cols={1} label="Armor" />
          <InventoryGrid items={items} slots={offhandSlot} cols={1} label="Offhand" />
        </div>
        <div>
          <InventoryGrid items={items} slots={mainSlots} cols={9} label="Inventory" />
          <InventoryGrid items={items} slots={hotbarSlots} cols={9} label="Hotbar" />
        </div>
      </div>
      {ender.length > 0 && (
        <InventoryGrid items={ender} slots={enderSlots} cols={9} label="Ender Chest" />
      )}
    </div>
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
