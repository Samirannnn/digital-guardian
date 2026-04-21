import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  icon: LucideIcon;
  accent?: "primary" | "emerald" | "crimson" | "cyber";
  index?: number;
};

const accentMap = {
  primary: { ring: "ring-primary/30", glow: "from-primary/30 to-cyber/10", text: "text-primary" },
  emerald: { ring: "ring-emerald/30", glow: "from-emerald/25 to-emerald/5", text: "text-emerald" },
  crimson: { ring: "ring-crimson/30", glow: "from-crimson/25 to-crimson/5", text: "text-crimson" },
  cyber: { ring: "ring-cyber/30", glow: "from-cyber/25 to-cyber/5", text: "text-cyber" },
};

export function StatCard({
  label,
  value,
  delta,
  trend = "up",
  icon: Icon,
  accent = "primary",
  index = 0,
}: Props) {
  const a = accentMap[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: "easeOut" }}
      className={`glass relative overflow-hidden rounded-2xl p-5 ring-1 ${a.ring} hover:ring-2 transition-all`}
    >
      <div className={`absolute -top-12 -right-12 h-40 w-40 rounded-full bg-gradient-to-br ${a.glow} blur-2xl`} />
      <div className="relative flex items-start justify-between">
        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </div>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          {delta && (
            <div
              className={`flex items-center gap-1 text-[11px] font-mono ${
                trend === "up" ? "text-emerald" : "text-crimson"
              }`}
            >
              {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta}
            </div>
          )}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl bg-white/5 border border-border ${a.text}`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  );
}
