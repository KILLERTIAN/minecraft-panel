"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Terminal,
  Users,
  ShieldCheck,
  Globe2,
  Network,
  SlidersHorizontal,
  Package,
  LogOut,
  Server,
} from "lucide-react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: null },
  { href: "/console", label: "Console", icon: Terminal, section: "Server" },
  { href: "/players", label: "Players", icon: Users, section: "Server" },
  { href: "/whitelist", label: "Whitelist", icon: ShieldCheck, section: "Server" },
  { href: "/world", label: "World & Backups", icon: Globe2, section: "Server" },
  { href: "/mods", label: "Mods", icon: Package, section: "Server" },
  { href: "/network", label: "Network", icon: Network, section: "System" },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal, section: "System" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  let lastSection: string | null = undefined as any;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Server size={18} color="#052018" strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar-brand-text">MC Panel</div>
          <div className="sidebar-brand-sub">Garcade Server</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {LINKS.map((l) => {
          const Icon = l.icon;
          const isActive = pathname === l.href;
          const showSection = l.section !== lastSection;
          lastSection = l.section;
          return (
            <div key={l.href}>
              {showSection && l.section && (
                <div className="sidebar-section">{l.section}</div>
              )}
              <Link href={l.href} className={`nav-link ${isActive ? "active" : ""}`}>
                <Icon size={16} strokeWidth={isActive ? 2.5 : 2} />
                {l.label}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          className="btn-ghost"
          onClick={logout}
          style={{ width: "100%", justifyContent: "center" }}
        >
          <LogOut size={15} />
          Log out
        </button>
      </div>
    </aside>
  );
}
