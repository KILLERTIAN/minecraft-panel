"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Server, Lock, ArrowRight, Loader2 } from "lucide-react";

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
      setError(d.error || "Invalid password");
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={submit}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56,
            height: 56,
            background: "linear-gradient(135deg, var(--accent) 0%, #0a8a64 100%)",
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 0 32px var(--accent-glow)",
          }}>
            <Server size={26} color="#052018" strokeWidth={2.5} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.4px" }}>
            MC Panel
          </div>
          <div style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 4 }}>
            Garcade Minecraft Server
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{
              fontSize: 11.5,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "var(--text-dim)",
              display: "block",
              marginBottom: 8,
            }}>
              Admin Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock size={15} style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-dim)",
                pointerEvents: "none",
              }} />
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{ paddingLeft: 38 }}
              />
            </div>
            {error && (
              <div className="error-text" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {error}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "11px 18px" }}
            disabled={loading || !password}
          >
            {loading ? (
              <>
                <Loader2 size={15} style={{ animation: "spin 0.8s linear infinite" }} />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
