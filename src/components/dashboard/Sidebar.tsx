import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Shield,
  LayoutDashboard,
  FolderLock,
  AlertTriangle,
  Globe2,
} from "lucide-react";

const items = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/vault", label: "Media Vault", icon: FolderLock },
  { to: "/alerts", label: "Security Alerts", icon: AlertTriangle },
  { to: "/map", label: "Global Tracking", icon: Globe2 },
];

export function Sidebar() {
  const location = useLocation();
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col gap-2 border-r border-border bg-surface/40 backdrop-blur-xl px-4 py-5 sticky top-0 h-screen">
      <Link to="/" className="flex items-center gap-2.5 px-2 py-2 mb-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-lg bg-primary/40 blur-md" />
          <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary to-cyber">
            <Shield className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold leading-none">Sentinel</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-1">
            DNA Protect
          </div>
        </div>
      </Link>

      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active = location.pathname === it.to;
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className="relative group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-cyber/10 border border-primary/30"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon
                className={`relative h-4.5 w-4.5 ${active ? "text-primary" : ""}`}
                size={18}
              />
              <span className={`relative ${active ? "text-foreground font-medium" : ""}`}>
                {it.label}
              </span>
              {active && (
                <span className="relative ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_currentColor]" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto glass rounded-xl p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
          </span>
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Network Status
          </span>
        </div>
        <div className="text-xs font-mono text-emerald">All systems nominal</div>
        <div className="mt-1 text-[10px] text-muted-foreground font-mono">
          1,284 nodes online
        </div>
      </div>
    </aside>
  );
}
