"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Heart, Utensils, Star, MapPin, Skull,
  Clock, ChevronDown, ChevronUp, MoreVertical, Loader2, Copy, Check,
  Timer, Swords,
} from "lucide-react";

interface PlayerStats {
  playTimeTicks: number | null;
  deaths: number;
  mobKills: number;
  playerKills: number;
  damageDealt: number;
  damageTaken: number;
}
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
  stats: PlayerStats | null;
}

function fmtPlaytime(ticks: number): string {
  const mins = Math.floor(ticks / 20 / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
interface Enchant {
  id: string;
  lvl: number;
}
interface InvItem {
  slot: number;
  id: string;
  count: number;
  name?: string | null;
  enchants?: Enchant[];
  damage?: number | null;
  maxDamage?: number | null;
  potion?: string | null;
}

function dimName(d: string): string {
  return d.replace("minecraft:", "").replace("the_", "").replace(/_/g, " ");
}
function itemName(id: string): string {
  return id.replace("minecraft:", "").replace(/_/g, " ");
}
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
function roman(n: number): string {
  const r = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return r[n] || String(n);
}
// Enchants capped at level I show no numeral in-game.
const SINGLE_LEVEL_ENCHANTS = new Set([
  "mending", "silk_touch", "infinity", "flame", "multishot", "channeling",
  "aqua_affinity", "binding_curse", "vanishing_curse",
]);
function enchantLabel(e: Enchant): string {
  const key = e.id.replace("minecraft:", "");
  const name = titleCase(key.replace(/_/g, " "));
  return SINGLE_LEVEL_ENCHANTS.has(key) ? name : `${name} ${roman(e.lvl)}`;
}
function isCurse(e: Enchant): boolean {
  return e.id.includes("curse") || e.id.includes("binding") || e.id.includes("vanishing");
}

// Aternos-style rendered item/block icons; falls back to emoji on 404.
function iconUrl(id: string): string {
  return `https://mc.nerothe.com/img/1.21.4/minecraft_${id.replace("minecraft:", "")}.png`;
}

// Max durability for common gear, so we can draw a durability bar even when
// the NBT doesn't carry a max_damage component.
const TOOL_BASE: Record<string, number> = { wooden: 59, stone: 131, iron: 250, golden: 32, diamond: 1561, netherite: 2031 };
const ARMOR_BASE: Record<string, [number, number, number, number]> = {
  // [helmet, chestplate, leggings, boots]
  leather: [55, 80, 75, 65],
  chainmail: [165, 240, 225, 195],
  iron: [165, 240, 225, 195],
  golden: [77, 112, 105, 91],
  diamond: [363, 528, 495, 429],
  netherite: [407, 592, 555, 481],
};
const MISC_DURABILITY: Record<string, number> = {
  bow: 384, crossbow: 465, trident: 250, shield: 336, fishing_rod: 64,
  flint_and_steel: 64, shears: 238, elytra: 432, mace: 500, carrot_on_a_stick: 25,
  warped_fungus_on_a_stick: 100, brush: 64, turtle_helmet: 275,
};
function maxDurability(id: string): number | null {
  const n = id.replace("minecraft:", "");
  if (MISC_DURABILITY[n]) return MISC_DURABILITY[n];
  const [mat, ...rest] = n.split("_");
  const kind = rest.join("_");
  if (TOOL_BASE[mat] && ["sword", "pickaxe", "axe", "shovel", "hoe"].includes(kind)) return TOOL_BASE[mat];
  if (ARMOR_BASE[mat]) {
    const idx = ["helmet", "chestplate", "leggings", "boots"].indexOf(kind);
    if (idx >= 0) return ARMOR_BASE[mat][idx];
  }
  return null;
}

const SLOT_SIZE = 46;
const SLOT_STYLE: React.CSSProperties = {
  width: SLOT_SIZE,
  height: SLOT_SIZE,
  background: "rgba(0,0,0,0.4)",
  border: "2px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  flexShrink: 0,
  transition: "border-color 0.12s",
};

function ItemIcon({ item }: { item: InvItem }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span style={{ fontSize: 22 }}>{itemEmoji(item.id)}</span>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl(item.id)}
      alt={itemName(item.id)}
      width={32}
      height={32}
      style={{ imageRendering: "pixelated", display: "block" }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ItemTooltip({ item }: { item: InvItem }) {
  const enchants = item.enchants || [];
  const max = item.maxDamage ?? maxDurability(item.id);
  const dmg = item.damage ?? 0;
  const showDur = max != null && dmg > 0;
  const durLeft = showDur ? max! - dmg : 0;
  const durPct = showDur ? Math.max(0, Math.min(1, durLeft / max!)) : 0;
  const durColor = durPct > 0.5 ? "#4ade80" : durPct > 0.25 ? "#facc15" : "#f87171";

  return (
    <div style={{
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(16,8,24,0.96)",
      border: "2px solid rgba(80,32,120,0.9)",
      borderRadius: 4,
      padding: "7px 11px",
      fontSize: 12,
      whiteSpace: "nowrap",
      zIndex: 200,
      pointerEvents: "none",
      boxShadow: "0 6px 20px rgba(0,0,0,0.6)",
      fontFamily: "var(--mono)",
      lineHeight: 1.55,
      textAlign: "left",
    }}>
      {/* Name: custom names italic aqua, enchanted items aqua, plain white */}
      <div style={{
        color: item.name ? "#55ffff" : enchants.length > 0 ? "#55ffff" : "#ffffff",
        fontStyle: item.name ? "italic" : "normal",
        fontWeight: 600,
        textTransform: item.name ? "none" : "capitalize",
      }}>
        {item.name || itemName(item.id)}
        {item.count > 1 && <span style={{ color: "#aaaaaa" }}> ×{item.count}</span>}
      </div>
      {item.name && (
        <div style={{ color: "#555560", fontSize: 10.5, textTransform: "capitalize" }}>{itemName(item.id)}</div>
      )}
      {item.potion && (
        <div style={{ color: "#ff55ff", textTransform: "capitalize" }}>
          {itemName(item.potion)}
        </div>
      )}
      {enchants.map((e) => (
        <div key={e.id} style={{ color: isCurse(e) ? "#ff5555" : "#a8a8ff" }}>
          {enchantLabel(e)}
        </div>
      ))}
      {showDur && (
        <div style={{ marginTop: 4 }}>
          <div style={{ color: "#aaaaaa", fontSize: 10.5 }}>
            Durability: {durLeft} / {max}
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.12)", borderRadius: 2, marginTop: 2 }}>
            <div style={{ height: "100%", width: `${durPct * 100}%`, background: durColor, borderRadius: 2 }} />
          </div>
        </div>
      )}
      <div style={{ color: "#555560", fontSize: 10 }}>{item.id}</div>
    </div>
  );
}

function SlotCell({ item, title }: { item?: InvItem; title?: string }) {
  const [hovered, setHovered] = useState(false);
  const enchanted = (item?.enchants?.length || 0) > 0;
  const max = item ? (item.maxDamage ?? maxDurability(item.id)) : null;
  const dmg = item?.damage ?? 0;
  const showDur = max != null && dmg > 0;
  const durPct = showDur ? Math.max(0, Math.min(1, (max! - dmg) / max!)) : 0;
  const durColor = durPct > 0.5 ? "#4ade80" : durPct > 0.25 ? "#facc15" : "#f87171";

  return (
    <div
      style={{
        ...SLOT_STYLE,
        borderColor: hovered && item
          ? "rgba(255,255,255,0.35)"
          : enchanted
            ? "rgba(167,139,250,0.45)"
            : "rgba(255,255,255,0.08)",
        background: enchanted ? "rgba(120,60,200,0.18)" : SLOT_STYLE.background,
        cursor: item ? "default" : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={!item ? title || "" : undefined}
    >
      {item ? (
        <>
          <ItemIcon item={item} />
          {item.count > 1 && (
            <span style={{
              position: "absolute", bottom: 2, right: 4,
              fontSize: 11, fontWeight: 700, color: "#fff",
              textShadow: "1px 1px 0 #000",
              fontFamily: "var(--mono)",
            }}>
              {item.count}
            </span>
          )}
          {showDur && (
            <div style={{ position: "absolute", left: 4, right: 4, bottom: 3, height: 3, background: "rgba(0,0,0,0.6)", borderRadius: 1 }}>
              <div style={{ height: "100%", width: `${durPct * 100}%`, background: durColor, borderRadius: 1 }} />
            </div>
          )}
          {hovered && <ItemTooltip item={item} />}
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
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 10.5, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${SLOT_SIZE}px)`, gap: 4 }}>
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

  if (items === null) return (
    <div style={{ color: "var(--text-dim)", marginTop: 12, display: "flex", alignItems: "center", gap: 7 }}>
      <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
      Loading inventory…
    </div>
  );
  if (items.length === 0 && ender.length === 0)
    return <div style={{ color: "var(--text-dim)", marginTop: 12, fontSize: 13 }}>Inventory is empty</div>;

  const mainSlots = Array.from({ length: 27 }, (_, i) => i + 9);
  const hotbarSlots = Array.from({ length: 9 }, (_, i) => i);
  const armorSlots = [36, 37, 38, 39];
  const offhandSlot = [40];
  const enderSlots = Array.from({ length: 27 }, (_, i) => i);

  return (
    <div style={{ marginTop: 18, overflowX: "auto", padding: "18px 0 4px" }}>
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
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
          <div style={{ marginTop: 20 }}>
            <InventoryGrid items={ender} slots={enderSlots} cols={9} label="Ender Chest" />
          </div>
        )}
      </div>
    </div>
  );
}

function ActionMenu({ name, online, onDone }: { name: string; online: boolean; onDone: () => void }) {
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
    if (r.ok) { setMsg(d.output || "Done"); onDone(); }
    else setMsg(d.error || "Failed");
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

  const items = [
    ...(online ? [
      { label: "Kick", onClick: () => { setOpen(false); kick(); } },
      { label: "Survival", onClick: () => { setOpen(false); act("gamemode", "survival"); } },
      { label: "Creative", onClick: () => { setOpen(false); act("gamemode", "creative"); } },
      { label: "Spectator", onClick: () => { setOpen(false); act("gamemode", "spectator"); } },
    ] : []),
    { label: "Op", onClick: () => { setOpen(false); act("op"); } },
    { label: "Deop", onClick: () => { setOpen(false); act("deop"); } },
    { label: "Ban", danger: true, onClick: () => { setOpen(false); ban(); } },
    { label: "Pardon", onClick: () => { setOpen(false); act("pardon"); } },
  ];

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        className="btn-ghost"
        style={{ padding: "7px 10px" }}
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 6px)",
            background: "var(--bg-elev2)",
            border: "1px solid var(--border-bright)",
            borderRadius: "var(--radius)",
            minWidth: 160,
            zIndex: 100,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            overflow: "hidden",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              style={{
                display: "flex", width: "100%", textAlign: "left",
                background: "none", border: "none", borderRadius: 0,
                padding: "10px 16px",
                color: (item as any).danger ? "var(--danger)" : "var(--text-mid)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "all 0.1s",
                borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.background = "var(--bg-elev3)"; (e.target as HTMLElement).style.color = (item as any).danger ? "var(--danger)" : "var(--text)"; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.background = "none"; (e.target as HTMLElement).style.color = (item as any).danger ? "var(--danger)" : "var(--text-mid)"; }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      {msg && (
        <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", fontSize: 12, color: "var(--accent)", whiteSpace: "nowrap", background: "var(--bg-elev2)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

interface Coords {
  x: number;
  y: number;
  z: number;
  dimension: string;
}

// Aternos-style location block: labeled X/Y/Z, dimension, copy-coords button.
function LocationBlock({ icon, label, coords, accent }: {
  icon: React.ReactNode;
  label: string;
  coords: Coords;
  accent: string;
}) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(`${coords.x} ${coords.y} ${coords.z}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div style={{
      flex: "1 1 240px", minWidth: 240,
      background: "var(--bg-elev2)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {icon}
          {label}
        </div>
        <button className="btn-icon" onClick={copy} title="Copy coordinates" style={{ padding: 5 }}>
          {copied ? <Check size={12} color="var(--accent)" /> : <Copy size={12} />}
        </button>
      </div>
      <div style={{ display: "flex", gap: 18, fontFamily: "var(--mono)", fontSize: 14, fontWeight: 600 }}>
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis}>
            <span style={{ color: "var(--text-dim)", fontSize: 11, textTransform: "uppercase", marginRight: 5 }}>{axis}</span>
            <span style={{ color: "var(--text)" }}>{coords[axis]}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: "var(--text-dim)", textTransform: "capitalize" }}>
        {dimName(coords.dimension)}
      </div>
    </div>
  );
}

function StatPill({ icon, value, color }: { icon: React.ReactNode; value: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text-dim)" }}>
      <span style={{ color }}>{icon}</span>
      <span style={{ fontWeight: 600, color: "var(--text-mid)" }}>{value}</span>
    </div>
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

  const onlineCount = players.filter((p) => p.online).length;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">Players</h1>
        <p className="page-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>{onlineCount}</span> online
          <span style={{ color: "var(--border-bright)" }}>·</span>
          {players.length} total
          <span style={{ color: "var(--border-bright)" }}>·</span>
          click to expand inventory
        </p>
      </div>

      {loading && (
        <div style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />
          Loading players…
        </div>
      )}

      {!loading && players.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: "40px 20px" }}>
          <Users size={36} style={{ color: "var(--text-dim)", margin: "0 auto 12px" }} />
          <div style={{ color: "var(--text-mid)", fontWeight: 600, fontSize: 15 }}>No players yet</div>
          <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>Players appear here after they join the world once.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {players.map((p) => {
          const isOpen = open === p.uuid;
          return (
            <div key={p.uuid} className="card" style={{ padding: 0, overflow: "visible" }}>
              {/* Header row */}
              <div
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", cursor: "pointer" }}
                onClick={() => setOpen(isOpen ? null : p.uuid)}
              >
                {p.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar}
                    alt={p.name}
                    width={44}
                    height={44}
                    style={{ borderRadius: 8, imageRendering: "pixelated", flexShrink: 0, border: "2px solid var(--border)" }}
                  />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--bg-elev2)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Users size={18} color="var(--text-dim)" />
                  </div>
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px" }}>{p.name}</span>
                    <span className={`badge ${p.online ? "badge-online" : "badge-offline"}`}>
                      <span className="dot" />
                      {p.online ? "Online" : "Offline"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                    {p.health != null && <StatPill icon={<Heart size={12} />} value={`${p.health} HP`} color="var(--danger)" />}
                    {p.foodLevel != null && <StatPill icon={<Utensils size={12} />} value={`${p.foodLevel}`} color="var(--warn)" />}
                    {p.xpLevel != null && <StatPill icon={<Star size={12} />} value={`Lvl ${p.xpLevel}`} color="var(--accent)" />}
                    {p.position && (
                      <StatPill
                        icon={<MapPin size={12} />}
                        value={`${p.position.x}, ${p.position.y}, ${p.position.z} (${dimName(p.position.dimension)})`}
                        color="var(--blue)"
                      />
                    )}
                    {p.stats?.playTimeTicks != null && (
                      <StatPill
                        icon={<Timer size={12} />}
                        value={fmtPlaytime(p.stats.playTimeTicks)}
                        color="var(--purple)"
                      />
                    )}
                    {p.stats && (
                      <StatPill
                        icon={<Skull size={12} />}
                        value={`${p.stats.deaths} deaths`}
                        color="var(--text-dim)"
                      />
                    )}
                    {p.stats && (
                      <StatPill
                        icon={<Swords size={12} />}
                        value={`${p.stats.mobKills + p.stats.playerKills} kills`}
                        color="var(--warn)"
                      />
                    )}
                    {p.lastModified && (
                      <StatPill
                        icon={<Clock size={12} />}
                        value={new Date(p.lastModified).toLocaleDateString()}
                        color="var(--text-dim)"
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={(e) => e.stopPropagation()}>
                  <ActionMenu name={p.name} online={p.online} onDone={refresh} />
                  <div style={{ color: "var(--text-dim)" }}>
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
              </div>

              {/* Expanded: locations + inventory */}
              {isOpen && (
                <div style={{ padding: "0 18px 18px" }}>
                  {(p.position || p.death) && (
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
                      {p.position && (
                        <LocationBlock
                          icon={<MapPin size={13} />}
                          label={p.online ? "Current Position (live)" : "Last Position"}
                          coords={p.position}
                          accent="var(--blue)"
                        />
                      )}
                      {p.death && (
                        <LocationBlock
                          icon={<Skull size={13} />}
                          label="Last Death"
                          coords={p.death}
                          accent="var(--danger)"
                        />
                      )}
                    </div>
                  )}
                  <InventoryPanel uuid={p.uuid} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
