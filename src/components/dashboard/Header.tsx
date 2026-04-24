import {
  Bell,
  Search,
  ChevronDown,
  Activity,
  LogOut,
  User,
  ShieldAlert,
  X,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useAssets } from "@/lib/assets";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: assets = [] } = useAssets();

  // Build notifications from leaked assets
  const notifications = assets
    .filter((a) => a.status === "leaked")
    .flatMap((a) =>
      a.locations.map((loc) => ({
        assetName: a.name,
        city: loc.city,
        country: loc.country,
        app: loc.app,
        confidence: loc.confidence,
        timestamp: loc.timestamp,
      })),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8); // show latest 8

  const unreadCount = notifications.length;

  // Close dropdowns on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Creator";
  const initial = displayName.charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/auth" });
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/60 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-4 lg:px-8 h-16">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 rounded-lg bg-white/5 border border-border px-3 py-1.5 w-80">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search assets, hashes, alerts…"
            className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden lg:inline-flex text-[10px] font-mono text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded border border-border">
            ⌘K
          </kbd>
        </div>

        <div className="ml-auto flex items-center gap-2 lg:gap-4">
          {/* Blockchain status */}
          <div className="hidden sm:flex items-center gap-2 rounded-lg glass px-3 py-1.5">
            <div className="relative">
              <Activity className="h-3.5 w-3.5 text-emerald" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Blockchain
              </span>
              <span className="text-[11px] font-mono text-emerald">Online · 18ms</span>
            </div>
          </div>

          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              id="notifications-bell"
              onClick={() => setNotifOpen((o) => !o)}
              className="relative grid h-9 w-9 place-items-center rounded-lg glass hover:border-primary/40 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-crimson shadow-[0_0_8px_var(--crimson)] animate-pulse" />
              )}
            </button>

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  key="notif-dropdown"
                  initial={{ opacity: 0, y: 8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 mt-2 w-80 rounded-xl glass border border-border overflow-hidden shadow-xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={14} className="text-crimson" />
                      <span className="text-xs font-semibold">Security Alerts</span>
                      {unreadCount > 0 && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-crimson/20 text-crimson border border-crimson/30">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setNotifOpen(false)}
                      className="grid h-6 w-6 place-items-center rounded-md hover:bg-white/5 text-muted-foreground"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  {/* Notifications list */}
                  <div className="max-h-72 overflow-y-auto divide-y divide-border">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald/15 border border-emerald/30 mb-3">
                          <Activity size={16} className="text-emerald" />
                        </div>
                        <p className="text-xs text-muted-foreground">No alerts — all assets clean</p>
                      </div>
                    ) : (
                      notifications.map((n, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors cursor-default"
                        >
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-crimson/15 text-crimson shrink-0 mt-0.5">
                            <ShieldAlert size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate leading-snug">
                              <span className="text-crimson">&ldquo;{n.assetName}&rdquo;</span>{" "}
                              leaked via {n.app}
                            </p>
                            <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                              <span className="flex items-center gap-0.5">
                                <MapPin size={9} />
                                {n.city}
                              </span>
                              <span className="text-crimson/80">{n.confidence}% match</span>
                            </div>
                            <p className="mt-0.5 text-[10px] text-muted-foreground/60 font-mono">
                              {formatDistanceToNow(new Date(n.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  {notifications.length > 0 && (
                    <div className="px-4 py-2.5 border-t border-border">
                      <button
                        onClick={() => {
                          setNotifOpen(false);
                          navigate({ to: "/alerts" });
                        }}
                        className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors group"
                      >
                        View all alerts
                        <ArrowRight
                          size={11}
                          className="transition-transform group-hover:translate-x-0.5"
                        />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              className="flex items-center gap-2.5 rounded-lg glass px-2 py-1.5 hover:border-primary/40 transition-colors"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-7 w-7 rounded-md object-cover"
                />
              ) : (
                <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-primary to-cyber text-primary-foreground text-xs font-bold">
                  {initial}
                </div>
              )}
              <div className="hidden sm:flex flex-col text-left leading-tight">
                <span className="text-xs font-medium">{displayName}</span>
                <span className="text-[10px] text-muted-foreground font-mono">creator · pro</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass border border-border overflow-hidden shadow-lg">
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="text-xs font-medium truncate">{displayName}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {user?.email}
                  </div>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-left"
                  onClick={() => setProfileOpen(false)}
                >
                  <User size={13} /> Account
                </button>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-left text-crimson"
                  onClick={handleSignOut}
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
