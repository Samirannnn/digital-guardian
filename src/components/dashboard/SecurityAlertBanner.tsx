import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, X, MapPin, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import type { ScanResult } from "@/lib/dna";

type Props = {
  fileName: string;
  result: ScanResult;
  onDismiss: () => void;
};

export function SecurityAlertBanner({ fileName, result, onDismiss }: Props) {
  const navigate = useNavigate();
  const count = result.locations.length;
  const topLoc = result.locations[0];

  return (
    <AnimatePresence>
      <motion.div
        key="security-alert-banner"
        initial={{ opacity: 0, y: -16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative overflow-hidden rounded-2xl border border-crimson/40 bg-crimson/10 backdrop-blur-sm"
      >
        {/* pulsing left accent bar */}
        <div className="absolute left-0 inset-y-0 w-1 bg-crimson rounded-l-2xl animate-pulse" />

        {/* subtle radial glow */}
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-crimson/20 blur-3xl pointer-events-none" />

        <div className="flex items-start gap-4 px-5 py-4">
          {/* icon */}
          <div className="relative mt-0.5 shrink-0">
            <div className="absolute inset-0 rounded-full bg-crimson/30 blur-xl animate-pulse" />
            <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-crimson/20 border border-crimson/40">
              <ShieldAlert size={18} className="text-crimson" />
            </div>
          </div>

          {/* content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-crimson/80">
                Security Alert
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-crimson/40 bg-crimson/10 text-crimson uppercase tracking-wider">
                Leak Detected
              </span>
            </div>

            <p className="mt-1 text-sm font-semibold text-foreground leading-snug">
              <span className="text-crimson">&ldquo;{fileName}&rdquo;</span> was found circulating
              in{" "}
              <span className="text-crimson font-bold">
                {count} unauthorized location{count > 1 ? "s" : ""}
              </span>
            </p>

            {topLoc && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <MapPin size={10} className="text-crimson/70" />
                  First detected: {topLoc.city}, {topLoc.country}
                </span>
                <span className="text-crimson/70">via {topLoc.app}</span>
                <span className="text-crimson/70">{topLoc.confidence}% confidence</span>
              </div>
            )}

            <button
              onClick={() => navigate({ to: "/alerts" })}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-crimson hover:text-crimson/80 transition-colors group"
            >
              View full report
              <ArrowRight
                size={12}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </button>
          </div>

          {/* dismiss */}
          <button
            onClick={onDismiss}
            className="shrink-0 grid h-7 w-7 place-items-center rounded-lg hover:bg-crimson/10 text-muted-foreground hover:text-crimson transition-colors"
            aria-label="Dismiss alert"
          >
            <X size={14} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
