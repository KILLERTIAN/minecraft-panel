"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Login failed");
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-box" onSubmit={submit}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>
          ⛏️ MC Panel
        </div>
        <div style={{ color: "var(--text-dim)", marginBottom: 20 }}>
          Enter admin password to continue
        </div>
        <input
          type="password"
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="error-text">{error}</div>}
        <button
          type="submit"
          className="btn-primary"
          style={{ width: "100%", marginTop: 16 }}
          disabled={loading || !password}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
