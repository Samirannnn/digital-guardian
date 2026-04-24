import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  AlertTriangle,
  MapPin,
  Smartphone,
  MessageCircle,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAssets, useAssetsRealtime } from "@/lib/assets";
import { useAuth } from "@/lib/auth";
import { useEffect } from "react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Security Alerts — Sentinel" },
      { name: "description", content: "Active leak detections across your protected library." },
      { property: "og:title", content: "Security Alerts — Sentinel" },
      {
        property: "og:description",
        content: "Real-time alerts for unauthorized redistribution of your media.",
      },
    ],
  }),
  component: AlertsPage,
});

function confidenceToSeverity(confidence: number): "critical" | "high" | "medium" {
  if (confidence >= 90) return "critical";
  if (confidence >= 78) return "high";
  return "medium";
}

const severityStyle = {
  critical: "bg-crimson/15 text-crimson border-crimson/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
};

function AlertsPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: assets = [], isLoading } = useAssets();
  useAssetsRealtime();

  // Auth guard
  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  // Flatten all leak locations from leaked assets into a single alerts list
  const alerts = assets
    .filter((a) => a.status === "leaked")
    .flatMap((a) =>
      a.locations.map((loc) => ({
        assetName: a.name,
        city: loc.city,
        country: loc.country,
        device: loc.device,
        app: loc.app,
        confidence: loc.confidence,
        severity: confidenceToSeverity(loc.confidence),
        timestamp: loc.timestamp,
      })),
    )
    .sort((a, b) => b.confidence - a.confidence);

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const highCount = alerts.filter((a) => a.severity === "high").length;
  const mediumCount = alerts.filter((a) => a.severity === "medium").length;

  if (authLoading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground font-mono">Loading…</div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <AlertTriangle size={12} /> Security Center
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Active <span className="text-crimson">Threats</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time leak detections from the Android network, ranked by signature confidence.
          </p>
        </header>

        {/* Severity summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Critical", count: criticalCount, cls: "text-crimson border-crimson/30" },
            { label: "High", count: highCount, cls: "text-orange-400 border-orange-500/30" },
            { label: "Medium", count: mediumCount, cls: "text-yellow-400 border-yellow-500/25" },
          ].map((s) => (
            <div key={s.label} className={`glass rounded-xl px-4 py-3 border ${s.cls}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className="text-2xl font-bold mt-0.5">{s.count}</div>
            </div>
          ))}
        </div>

        {/* Alerts list */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Live Alerts</span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {isLoading ? "Syncing…" : `${alerts.length} detection${alerts.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5 animate-pulse">
                  <div className="h-10 w-10 rounded-lg bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-48 rounded bg-white/5" />
                    <div className="h-2.5 w-64 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state — no leaks */}
          {!isLoading && alerts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald/20 blur-xl" />
                <div className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald/15 border border-emerald/30">
                  <ShieldCheck className="h-7 w-7 text-emerald" />
                </div>
              </div>
              <h3 className="text-base font-semibold">No active threats</h3>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-xs">
                All your protected assets are clean. Upload an asset to the dashboard to register
                its signature and start monitoring.
              </p>
            </div>
          )}

          {/* Alert rows */}
          <AnimatePresence>
            {!isLoading && alerts.length > 0 && (
              <div className="divide-y divide-border">
                {alerts.map((a, i) => (
                  <motion.div
                    key={`${a.assetName}-${i}`}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/[0.03] transition-colors"
                  >
                    {/* Severity icon */}
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${severityStyle[a.severity]}`}
                    >
                      <ShieldAlert size={16} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate max-w-[180px]">
                          {a.assetName}
                        </span>
                        <span
                          className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityStyle[a.severity]}`}
                        >
                          {a.severity}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-mono">
                        <span className="flex items-center gap-1">
                          <MapPin size={10} />
                          {a.city}
                          {a.country ? `, ${a.country}` : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <Smartphone size={10} />
                          {a.device}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle size={10} />
                          {a.app}
                        </span>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-crimson font-bold">
                        {a.confidence}%
                      </div>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground font-mono mt-0.5">
                        <Clock size={9} />
                        {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </DashboardLayout>
  );
}
