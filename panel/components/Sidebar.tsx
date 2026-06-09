"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/console", label: "Console" },
  { href: "/players", label: "Players" },
  { href: "/whitelist", label: "Whitelist" },
  { href: "/world", label: "World & Backups" },
  { href: "/network", label: "Network" },
  { href: "/settings", label: "Server Settings" },
  { href: "/mods", label: "Mods" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <aside className="sidebar">
      <div className="brand">⛏️ MC Panel</div>
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`nav-link ${pathname === l.href ? "active" : ""}`}
        >
          {l.label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <button className="btn-ghost" onClick={logout}>
        Log out
      </button>
    </aside>
  );
}
