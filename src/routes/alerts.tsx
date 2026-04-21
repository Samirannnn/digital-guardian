import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AlertTriangle, MapPin, Smartphone, MessageCircle, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/alerts")({
  head: () => ({
    meta: [
      { title: "Security Alerts — Sentinel" },
      { name: "description", content: "Active leak detections across your protected library." },
      { property: "og:title", content: "Security Alerts — Sentinel" },
      { property: "og:description", content: "Real-time alerts for unauthorized redistribution of your media." },
    ],
  }),
  component: AlertsPage,
});

const alerts = [
  { city: "Kolkata, IN", device: "Realme 8", app: "WhatsApp", confidence: 94, asset: "whatsapp_test_photo.jpg", severity: "critical" as const, ago: "2m" },
  { city: "Mumbai, IN", device: "Samsung A52", app: "Telegram", confidence: 88, asset: "campaign_poster_v3.jpg", severity: "high" as const, ago: "12m" },
  { city: "Lagos, NG", device: "Tecno Spark 8", app: "WhatsApp", confidence: 81, asset: "model_shoot_final.jpg", severity: "high" as const, ago: "47m" },
  { city: "Dubai, AE", device: "iPhone 12", app: "Instagram DM", confidence: 76, asset: "campaign_poster_v3.jpg", severity: "medium" as const, ago: "1h" },
  { city: "Manila, PH", device: "Oppo A15", app: "Snapchat", confidence: 72, asset: "model_shoot_final.jpg", severity: "medium" as const, ago: "3h" },
  { city: "São Paulo, BR", device: "Xiaomi Redmi", app: "WhatsApp", confidence: 91, asset: "whatsapp_test_photo.jpg", severity: "critical" as const, ago: "5h" },
];

const severityStyle = {
  critical: "bg-crimson/15 text-crimson border-crimson/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25",
};

function AlertsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <AlertTriangle size={12} /> Security Center
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Active <span className="text-crimson">Threats</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Detections from the Android network, ranked by signature confidence.
          </p>
        </header>

        {/* Severity summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Critical", count: 2, cls: "text-crimson border-crimson/30" },
            { label: "High", count: 2, cls: "text-orange-400 border-orange-500/30" },
            { label: "Medium", count: 2, cls: "text-yellow-400 border-yellow-500/25" },
          ].map((s) => (
            <div key={s.label} className={`glass rounded-xl px-4 py-3 border ${s.cls}`}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <div className="text-2xl font-bold mt-0.5">{s.count}</div>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-semibold">Live Alerts</span>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Sorted by confidence
            </span>
          </div>
          <div className="divide-y divide-border">
            {alerts.map((a, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-white/[0.03] transition-colors"
              >
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${severityStyle[a.severity]}`}>
                  <AlertTriangle size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{a.asset}</span>
                    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityStyle[a.severity]}`}>
                      {a.severity}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1"><MapPin size={10} />{a.city}</span>
                    <span className="flex items-center gap-1"><Smartphone size={10} />{a.device}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={10} />{a.app}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono text-primary">{a.confidence}%</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{a.ago} ago</div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
