import { Bell, Search, ChevronDown, Activity, LogOut, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { user, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

          {/* Notification */}
          <button className="relative grid h-9 w-9 place-items-center rounded-lg glass hover:border-primary/40 transition-colors">
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-crimson shadow-[0_0_8px_currentColor]" />
          </button>

          {/* Profile */}
          <div className="relative" ref={ref}>
            <button
              onClick={() => setOpen((o) => !o)}
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

            {open && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl glass border border-border overflow-hidden shadow-lg">
                <div className="px-3 py-2.5 border-b border-border">
                  <div className="text-xs font-medium truncate">{displayName}</div>
                  <div className="text-[10px] font-mono text-muted-foreground truncate">
                    {user?.email}
                  </div>
                </div>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-white/5 text-left"
                  onClick={() => setOpen(false)}
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
