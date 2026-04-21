import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, MapPin } from "lucide-react";

type Alert = {
  id: number;
  city: string;
  device: string;
  app: string;
  hash: string;
  confidence: number;
  ts: string;
};

const sample = [
  { city: "Kolkata", device: "Realme 8", app: "WhatsApp" },
  { city: "Mumbai", device: "Samsung A52", app: "Telegram" },
  { city: "Dhaka", device: "Vivo Y20", app: "Messenger" },
  { city: "Lagos", device: "Tecno Spark", app: "WhatsApp" },
  { city: "Manila", device: "Oppo A15", app: "Snapchat" },
  { city: "Cairo", device: "Xiaomi Redmi", app: "Telegram" },
  { city: "Karachi", device: "Infinix Hot", app: "WhatsApp" },
  { city: "Dubai", device: "iPhone 12", app: "Instagram" },
];

function rndHash() {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

export function GlobalAlertsFeed() {
  const [alerts, setAlerts] = useState<Alert[]>(() =>
    Array.from({ length: 6 }).map((_, i) => {
      const s = sample[i % sample.length];
      return {
        id: Date.now() + i,
        ...s,
        hash: rndHash(),
        confidence: 75 + Math.floor(Math.random() * 24),
        ts: new Date(Date.now() - i * 45_000).toISOString(),
      };
    }),
  );

  useEffect(() => {
    const t = setInterval(() => {
      const s = sample[Math.floor(Math.random() * sample.length)];
      setAlerts((prev) =>
        [
          {
            id: Date.now(),
            ...s,
            hash: rndHash(),
            confidence: 75 + Math.floor(Math.random() * 24),
            ts: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 12),
      );
    }, 3500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass rounded-2xl flex flex-col h-full max-h-[640px] overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-crimson" />
        </span>
        <Radio size={14} className="text-crimson" />
        <span className="text-sm font-semibold">Live Detection Feed</span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          Android Network
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <AnimatePresence initial={false}>
          {alerts.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, x: 30, height: 0 }}
              animate={{ opacity: 1, x: 0, height: "auto" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="px-4 py-3 border-b border-border/60 last:border-0 hover:bg-white/[0.03]"
            >
              <div className="flex items-center gap-2 text-xs">
                <MapPin size={12} className="text-crimson shrink-0" />
                <span className="font-semibold">{a.city}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                  {timeAgo(a.ts)}
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground font-mono truncate">
                {a.device} · {a.app}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <code className="text-[10px] font-mono text-primary/80 truncate">
                  0x{a.hash}…
                </code>
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-crimson/15 text-crimson">
                  {a.confidence}%
                </span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
