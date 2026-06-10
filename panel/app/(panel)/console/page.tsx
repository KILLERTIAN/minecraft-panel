"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal, Send, Wifi, WifiOff, Trash2 } from "lucide-react";

interface Line {
  id: number;
  text: string;
}

function classify(text: string): string {
  if (/\bERROR\b|\bSEVERE\b|Exception/i.test(text)) return "line-err";
  if (/\bWARN\b/i.test(text)) return "line-warn";
  return "line-info";
}

export default function ConsolePage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [connected, setConnected] = useState(false);
  const [cmd, setCmd] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const counter = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const push = useCallback((texts: string[]) => {
    setLines((prev) => {
      const next = [...prev];
      for (const t of texts) next.push({ id: counter.current++, text: t });
      return next.slice(-500);
    });
  }, []);

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type === "history") push(m.lines);
        else if (m.type === "console") push([m.line]);
      } catch {}
    };
    return () => ws.close();
  }, [push]);

  useEffect(() => {
    const el = boxRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  function onScroll() {
    const el = boxRef.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const c = cmd.trim();
    if (!c) return;
    setHistory((h) => [c, ...h.slice(0, 49)]);
    setHistIdx(-1);
    setCmd("");
    const r = await fetch("/api/server/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: c }),
    });
    const d = await r.json();
    if (!r.ok) push([`[panel] error: ${d.error}`]);
    else if (d.output) push([`[rcon] > ${c}`, d.output]);
    else push([`[rcon] > ${c}`]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      if (history[idx]) setCmd(history[idx]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setCmd(idx === -1 ? "" : history[idx]);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="page-title">Console</h1>
            <p className="page-sub" style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5 }}>
              Live server output ·{" "}
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                color: connected ? "var(--accent)" : "var(--warn)",
                fontWeight: 600,
              }}>
                {connected
                  ? <><Wifi size={12} /> Connected</>
                  : <><WifiOff size={12} /> Disconnected</>
                }
              </span>
            </p>
          </div>
          <button
            className="btn-ghost"
            onClick={() => setLines([])}
            style={{ padding: "8px 14px" }}
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      <div className="console" ref={boxRef} onScroll={onScroll}>
        {lines.length === 0 && (
          <div style={{ color: "var(--text-dim)", display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={14} />
            Waiting for server output… start the server if it's offline.
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={classify(l.text)}>
            {l.text}
          </div>
        ))}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{
            position: "absolute",
            left: 14,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--accent)",
            fontFamily: "var(--mono)",
            fontSize: 14,
            pointerEvents: "none",
          }}>
            /
          </span>
          <input
            placeholder="say hello · time set day · weather clear · ↑↓ history"
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ fontFamily: "var(--mono)", paddingLeft: 26 }}
          />
        </div>
        <button className="btn-primary" type="submit" disabled={!cmd.trim()} style={{ flexShrink: 0 }}>
          <Send size={15} />
          Send
        </button>
      </form>
    </div>
  );
}
