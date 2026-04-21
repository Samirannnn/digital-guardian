import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, MapPin, Smartphone, MessageCircle, Hash, X } from "lucide-react";
import type { ScanResult } from "@/lib/dna";
import { WorldMap } from "./WorldMap";

type Props = {
  imageUrl: string;
  result: ScanResult;
  onClose: () => void;
};

export function ResultView({ imageUrl, result, onClose }: Props) {
  const leaked = result.status === "leaked";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid gap-4 lg:grid-cols-2"
    >
      {/* LEFT — image + signature */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-primary" />
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Signature Generated
            </span>
          </div>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/5 text-muted-foreground"
          >
            <X size={14} />
          </button>
        </div>

        <div className="relative aspect-[4/3] bg-black/40">
          <img src={imageUrl} alt="Scanned asset" className="absolute inset-0 h-full w-full object-cover" />
          {/* hex overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 font-mono text-[10px] leading-relaxed text-primary/90">
            <div className="text-[9px] uppercase tracking-[0.2em] text-primary/70 mb-1.5">
              pHash · 256 bit
            </div>
            <div className="break-all">
              {result.hash.match(/.{1,4}/g)?.join(" ")}
            </div>
          </div>
          {/* scanning grid corners */}
          {["top-3 left-3 border-l-2 border-t-2", "top-3 right-3 border-r-2 border-t-2", "bottom-3 left-3 border-l-2 border-b-2", "bottom-3 right-3 border-r-2 border-b-2"].map((c) => (
            <div key={c} className={`absolute h-5 w-5 border-primary ${c}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-px bg-border">
          <Stat label="Block #" value={`#${result.blockNumber.toLocaleString()}`} />
          <Stat label="Algorithm" value="pHash-256" />
          <Stat label="Network" value="Polygon" />
        </div>
      </div>

      {/* RIGHT — distribution report */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col">
        <div
          className={`px-4 py-3 border-b border-border flex items-center gap-2 ${
            leaked ? "bg-crimson/10" : "bg-emerald/10"
          }`}
        >
          {leaked ? (
            <ShieldAlert size={16} className="text-crimson" />
          ) : (
            <ShieldCheck size={16} className="text-emerald" />
          )}
          <span className={`text-sm font-semibold ${leaked ? "text-crimson" : "text-emerald"}`}>
            {leaked ? "Leak Detected" : "Asset is Clean"}
          </span>
          <span className="ml-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Distribution Report
          </span>
        </div>

        {leaked ? (
          <>
            <div className="p-2 border-b border-border">
              <WorldMap pins={result.locations} compact />
            </div>
            <div className="flex-1 max-h-72 overflow-auto divide-y divide-border">
              {result.locations.map((loc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="p-4 flex items-start gap-3 hover:bg-white/[0.03]"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-crimson/15 text-crimson shrink-0">
                    <MapPin size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{loc.city}, {loc.country}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-crimson/15 text-crimson">
                        {loc.confidence}% match
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground font-mono">
                      <span className="flex items-center gap-1">
                        <Smartphone size={11} /> {loc.device}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={11} /> {loc.app}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center p-10 text-center">
            <div>
              <div className="relative mx-auto mb-4 h-16 w-16">
                <div className="absolute inset-0 rounded-full bg-emerald/30 blur-xl" />
                <div className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald/15 border border-emerald/30 pulse-ring">
                  <ShieldCheck className="h-7 w-7 text-emerald" />
                </div>
              </div>
              <h3 className="text-lg font-semibold">No unauthorized copies found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
                Your signature has been written to the ledger. We will alert you if it surfaces.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card/40 px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-xs font-mono mt-0.5 truncate">{value}</div>
    </div>
  );
}
