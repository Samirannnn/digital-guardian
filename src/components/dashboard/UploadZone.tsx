import { useCallback, useRef, useState } from "react";
import { UploadCloud, Fingerprint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  onFile: (file: File) => void;
  scanning: boolean;
  progress: number;
  stage: string;
};

export function UploadZone({ onFile, scanning, progress, stage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleFile = useCallback(
    (file?: File | null) => {
      if (!file) return;
      onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
      onClick={() => !scanning && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl glass overflow-hidden transition-all ${
        drag ? "ring-2 ring-primary glow-primary" : "ring-1 ring-border hover:ring-primary/40"
      } ${scanning ? "pointer-events-none" : ""}`}
    >
      <div className="absolute inset-0 grid-bg opacity-50" />
      {/* glowing border accent */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 via-primary/10 to-cyber/15 pointer-events-none" />

      <input
        ref={inputRef}
        type="file"
        accept="*/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="relative px-6 py-12 lg:py-16 flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          {!scanning ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <div className="relative mb-5 animate-float">
                <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-2xl" />
                <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-cyber glow-primary">
                  <UploadCloud className="h-7 w-7 text-primary-foreground" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-xl font-semibold tracking-tight">
                Drop any file to scan its <span className="text-gradient-primary">Digital DNA</span>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                We compute a perceptual hash (images) or SHA-256 fingerprint (other files) and query
                the blockchain ledger for unauthorized redistribution.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] font-mono text-muted-foreground">
                {["JPG · PNG · WebP", "PDF", "MP3", "ZIP", "Any file"].map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded-full border border-border bg-black/30">
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="scan"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-md"
            >
              <div className="relative h-16 w-16 mx-auto mb-5">
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/40" />
                <div className="absolute inset-0 rounded-2xl border-t-2 border-primary animate-spin" />
                <div className="absolute inset-2 rounded-xl bg-primary/10 grid place-items-center">
                  <Fingerprint className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="text-sm font-mono text-primary mb-3">{stage}</div>

              {/* cyberpunk progress */}
              <div className="relative h-2 rounded-full bg-white/5 overflow-hidden border border-border">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-cyber to-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear" }}
                />
                <div className="absolute inset-0 scan-line animate-scan opacity-60" />
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>0x00</span>
                <span>{progress}%</span>
                <span>0xFF</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
