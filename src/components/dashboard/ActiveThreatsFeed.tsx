import { useAssets } from "@/lib/assets";
import { ShieldCheck, ShieldAlert, MapPin, Smartphone, MessageCircle, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";

export function ActiveThreatsFeed() {
  const { data: assets = [], isLoading } = useAssets();
  const navigate = useNavigate();

  // Filter and flatten all leak locations from leaked assets
  const alerts = assets
    .filter((a) => a.status === "leaked")
    .flatMap((a) =>
      a.locations.map((loc) => ({
        id: `${a.id}-${loc.timestamp}-${loc.lat}-${loc.lng}`,
        assetId: a.id,
        assetName: a.name,
        city: loc.city,
        country: loc.country,
        device: loc.device,
        app: loc.app,
        confidence: loc.confidence,
        timestamp: loc.timestamp,
        signedUrl: a.signedUrl,
      }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4 space-y-3 animate-pulse border border-border/80 h-full min-h-[300px]">
        <div className="h-4 w-32 bg-white/5 rounded" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl flex flex-col h-full max-h-[640px] overflow-hidden border border-border/80">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-black/20 shrink-0">
        {alerts.length > 0 ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-crimson" />
            </span>
            <ShieldAlert size={14} className="text-crimson" />
            <span className="text-sm font-semibold text-white">Active Threat Feed</span>
            <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-crimson/15 text-crimson border border-crimson/30">
              {alerts.length} ALERT{alerts.length !== 1 ? "S" : ""}
            </span>
          </>
        ) : (
          <>
            <ShieldCheck size={14} className="text-emerald" />
            <span className="text-sm font-semibold text-white">Security Integrity</span>
            <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald/15 text-emerald border border-emerald/30">
              SECURE
            </span>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        <AnimatePresence initial={false}>
          {alerts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-emerald/10 blur-xl" />
                <div className="relative grid h-12 w-12 place-items-center rounded-full bg-emerald/15 border border-emerald/30">
                  <ShieldCheck className="h-6 w-6 text-emerald" />
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white">No active leaks</h4>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px] mx-auto leading-relaxed">
                  Your registered assets are secure. If anyone uploads duplicates, they will report here.
                </p>
              </div>
            </motion.div>
          ) : (
            alerts.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4) }}
                onClick={() => navigate({ to: "/alerts" })}
                className="px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer flex gap-3 items-start group"
              >
                {/* Image preview or icon */}
                <div className="relative h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-black/40 border border-border">
                  {a.signedUrl && ["jpg", "jpeg", "png", "webp", "gif"].includes(a.assetName.split(".").pop()?.toLowerCase() || "") ? (
                    <img src={a.signedUrl} alt="leak" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center text-[10px] text-muted-foreground bg-gradient-to-br from-crimson/10 to-primary/10 font-mono uppercase font-bold">
                      {a.assetName.split(".").pop()?.slice(0, 3) || "file"}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20" />
                </div>

                {/* Info block */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 justify-between">
                    <span className="font-semibold text-xs text-white truncate max-w-[130px] group-hover:text-primary transition-colors">
                      {a.assetName}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-crimson shrink-0 bg-crimson/15 px-1.5 py-0.2 rounded border border-crimson/25">
                      {a.confidence}% MATCH
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                    <MapPin size={10} className="text-crimson/80 shrink-0" />
                    <span className="truncate">{a.city}{a.country ? `, ${a.country}` : ""}</span>
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground/80 font-mono">
                    <span className="flex items-center gap-0.5">
                      <Smartphone size={8} className="shrink-0" /> {a.device}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <MessageCircle size={8} className="shrink-0" /> {a.app}
                    </span>
                  </div>

                  <div className="mt-1.5 text-[9px] text-muted-foreground/60 font-mono flex items-center gap-1">
                    <span>Detected {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}</span>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {alerts.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-black/10 shrink-0">
          <button
            onClick={() => navigate({ to: "/alerts" })}
            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-crimson hover:text-crimson/80 transition-colors group py-1"
          >
            View Live Threats Report
            <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  );
}
