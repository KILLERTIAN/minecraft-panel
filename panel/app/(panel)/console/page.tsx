"use client";

import { useEffect, useRef, useState, useCallback } from "react";

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
  const counter = useRef(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const push = useCallback((texts: string[]) => {
    setLines((prev) => {
      const next = [...prev];
      for (const t of texts) next.push({ id: counter.current++, text: t });
      // Cap rendered lines.
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
    setCmd("");
    const r = await fetch("/api/server/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: c }),
    });
    const d = await r.json();
    if (!r.ok) push([`[panel] error: ${d.error}`]);
    else if (d.output) push([`[panel] > ${c}`, d.output]);
    else push([`[panel] > ${c}`]);
  }

  return (
    <>
      <div className="page-title">Console</div>
      <div className="page-sub">
        Live server logs ·{" "}
        <span style={{ color: connected ? "var(--accent)" : "var(--warn)" }}>
          {connected ? "connected" : "disconnected"}
        </span>
      </div>

      <div className="console" ref={boxRef} onScroll={onScroll}>
        {lines.length === 0 && (
          <div style={{ color: "var(--text-dim)" }}>
            Waiting for server output… (start the server if it's offline)
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={classify(l.text)}>
            {l.text}
          </div>
        ))}
      </div>

      <form onSubmit={send} style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <input
          placeholder="Type a command (e.g. say hello, time set day, weather clear)"
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          style={{ fontFamily: "var(--mono)" }}
        />
        <button className="btn-primary" type="submit" disabled={!cmd.trim()}>
          Send
        </button>
      </form>
    </>
  );
}
