import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  action: "enable" | "disable";
  assetName: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ProtectionConfirmModal({
  open,
  action,
  assetName,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const isEnable = action === "enable";

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 grid place-items-center bg-black/75 backdrop-blur-sm px-4"
        onClick={onCancel}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass rounded-2xl p-6 w-full max-w-md space-y-4 border border-border"
        >
          <div className="flex items-center gap-3">
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl shrink-0 ${
                isEnable ? "bg-crimson/20 text-crimson" : "bg-emerald/20 text-emerald"
              }`}
            >
              {isEnable ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isEnable ? "Enable Asset Protection?" : "Disable Asset Protection?"}
              </h3>
              <div className="text-xs text-muted-foreground font-mono truncate max-w-[240px]">
                {assetName}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {isEnable ? (
              <>
                Other users will only be able to see a{" "}
                <span className="text-foreground font-semibold">blurred preview</span> of this asset.
                The owner will continue to have full access to the original asset.
              </>
            ) : (
              <>
                Other users will be able to see the{" "}
                <span className="text-foreground font-semibold">normal asset preview</span> according to
                its visibility settings.
              </>
            )}
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/50">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-white border border-border hover:border-border/80 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer ${
                isEnable
                  ? "bg-crimson hover:bg-crimson/90 shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                  : "bg-emerald hover:bg-emerald/90 text-emerald-foreground shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              } disabled:opacity-50`}
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {isEnable ? "Enable Protection" : "Disable Protection"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
