import type { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import {
  LayoutDashboard,
  FolderLock,
  AlertTriangle,
  Globe2,
  Settings2,
} from "lucide-react";

const mobileItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/vault", label: "Vault", icon: FolderLock },
  { to: "/alerts", label: "Alerts", icon: AlertTriangle },
  { to: "/map", label: "Map", icon: Globe2 },
  { to: "/settings", label: "API", icon: Settings2 },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-screen flex w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 px-4 lg:px-8 py-6 pb-24 lg:pb-8">{children}</main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl">
          <div className="flex justify-around py-2">
            {mobileItems.map((it) => {
              const active = location.pathname === it.to;
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-[10px] font-medium">{it.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
