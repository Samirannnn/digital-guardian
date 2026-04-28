import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAssets, useAssetsRealtime } from "@/lib/assets";
import { useAuth } from "@/lib/auth";
import {
  ShieldCheck,
  AlertOctagon,
  FolderLock,
  Hash,
  Calendar,
  ArrowLeft,
  Trash2,
  EyeOff,
  Send,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { toScanResult, deleteAsset, type AssetWithLocations } from "@/lib/assets";
import { ResultView } from "@/components/dashboard/ResultView";
import { enforceBlur, transferOwnership } from "@/lib/phash";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Media Vault — Sentinel" },
      { name: "description", content: "Your protected media library with on-chain signatures." },
      { property: "og:title", content: "Media Vault — Sentinel" },
      { property: "og:description", content: "Browse every protected asset and its leak status." },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const { session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: items = [], isLoading, refetch } = useAssets();
  const [selectedAsset, setSelectedAsset] = useState<AssetWithLocations | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [enforcingId, setEnforcingId] = useState<string | null>(null);
  const [transferTarget, setTransferTarget] = useState<AssetWithLocations | null>(null);
  const [newOwnerEmail, setNewOwnerEmail] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  useAssetsRealtime();

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const handleDelete = async (asset: AssetWithLocations, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${asset.name}"? This cannot be undone.`)) {
      setIsDeleting(true);
      try {
        await deleteAsset(asset.id, asset.storage_path);
        toast.success(`Deleted "${asset.name}"`);
        if (selectedAsset?.id === asset.id) setSelectedAsset(null);
        refetch();
      } catch (err) {
        toast.error("Failed to delete asset.");
        console.error(err);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleBlurEnforce = async (asset: AssetWithLocations, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.email) return;
    setEnforcingId(asset.id);
    try {
      const result = await enforceBlur(asset.hash, user.email);
      if (result.success) {
        toast.success(`🛡️ Blur enforcement activated for "${asset.name}"`);
      } else {
        toast.error("Blur enforcement failed — you may not be the registered owner.");
      }
    } catch {
      toast.error("Enforcement request failed.");
    } finally {
      setEnforcingId(null);
    }
  };

  const handleTransfer = async () => {
    if (!transferTarget || !user?.email || !newOwnerEmail.trim()) return;
    setIsTransferring(true);
    try {
      const result = await transferOwnership(transferTarget.hash, user.email, newOwnerEmail.trim());
      if (result.success) {
        toast.success(`✅ Ownership of "${transferTarget.name}" transferred to ${newOwnerEmail}`);
        setTransferTarget(null);
        setNewOwnerEmail("");
      } else {
        toast.error(result.message || "Transfer failed — you may not be the registered owner.");
      }
    } catch {
      toast.error("Transfer request failed.");
    } finally {
      setIsTransferring(false);
    }
  };

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
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <FolderLock size={12} /> Media Vault
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Protected Library
          </h1>
          {selectedAsset ? (
            <button
              onClick={() => setSelectedAsset(null)}
              className="mt-4 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium w-fit"
            >
              <ArrowLeft size={16} /> Back to Vault
            </button>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Every asset is fingerprinted and anchored on-chain. Click any item to inspect its
              signature. As the registered owner, you can blur the image globally or transfer
              ownership.
            </p>
          )}
        </header>

        {isLoading ? (
          <div className="text-sm text-muted-foreground font-mono">Loading vault…</div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : selectedAsset ? (
          <AnimatePresence mode="wait">
            <ResultView
              key="result"
              imageUrl={selectedAsset.signedUrl ?? ""}
              result={toScanResult(selectedAsset)}
              onClose={() => setSelectedAsset(null)}
            />
          </AnimatePresence>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((it, i) => (
              <VaultCard
                key={it.id}
                asset={it}
                index={i}
                isEnforcing={enforcingId === it.id}
                onClick={() => setSelectedAsset(it)}
                onDelete={(e) => handleDelete(it, e)}
                onBlurEnforce={(e) => handleBlurEnforce(it, e)}
                onTransfer={(e) => {
                  e.stopPropagation();
                  setTransferTarget(it);
                  setNewOwnerEmail("");
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Transfer Ownership Modal */}
      <AnimatePresence>
        {transferTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setTransferTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-md space-y-4"
            >
              <div>
                <h2 className="text-lg font-bold tracking-tight">Transfer Ownership</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Transfer authorization of{" "}
                  <span className="text-foreground font-medium">"{transferTarget.name}"</span> to
                  another user. They will become the sole authorized owner on-chain.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  New Owner Email
                </label>
                <input
                  type="email"
                  value={newOwnerEmail}
                  onChange={(e) => setNewOwnerEmail(e.target.value)}
                  placeholder="newowner@example.com"
                  className="w-full rounded-lg bg-black/40 border border-border px-3 py-2 text-sm outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setTransferTarget(null)}
                  className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:border-border/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransfer}
                  disabled={isTransferring || !newOwnerEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary to-cyber text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isTransferring ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Transfer
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}

function EmptyState() {
  return (
    <div className="glass rounded-2xl p-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-cyber glow-primary">
        <FolderLock className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="text-base font-semibold">Your vault is empty</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Head to the dashboard and drop your first asset to register its signature.
      </p>
    </div>
  );
}

type CardProps = {
  asset: AssetWithLocations;
  index: number;
  isEnforcing: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onBlurEnforce: (e: React.MouseEvent) => void;
  onTransfer: (e: React.MouseEvent) => void;
};

function VaultCard({
  asset,
  index,
  isEnforcing,
  onClick,
  onDelete,
  onBlurEnforce,
  onTransfer,
}: CardProps) {
  const { name, status, created_at: uploadedAt, hash, signedUrl: imageUrl } = asset;
  const leaked = status === "leaked";

  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
      className="glass rounded-xl overflow-hidden group hover:ring-1 hover:ring-primary/40 transition-all text-left w-full cursor-pointer flex flex-col relative"
    >
      <div className="relative aspect-square bg-black/40">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 to-cyber/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

        {/* Status badge */}
        <div
          className={`absolute top-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md border ${
            leaked
              ? "bg-crimson/20 text-crimson border-crimson/40"
              : "bg-emerald/20 text-emerald border-emerald/40"
          }`}
        >
          {leaked ? <AlertOctagon size={10} /> : <ShieldCheck size={10} />}
          {leaked ? "Compromised" : "Protected"}
        </div>

        {/* Action buttons — visible on hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Blur Enforcement */}
          <button
            onClick={onBlurEnforce}
            disabled={isEnforcing}
            title="Enforce Global Blur"
            className="grid h-7 w-7 place-items-center rounded-lg bg-black/50 text-muted-foreground hover:bg-primary/80 hover:text-white backdrop-blur-md transition-colors"
          >
            {isEnforcing ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <EyeOff size={11} />
            )}
          </button>

          {/* Transfer Ownership */}
          <button
            onClick={onTransfer}
            title="Transfer Ownership"
            className="grid h-7 w-7 place-items-center rounded-lg bg-black/50 text-muted-foreground hover:bg-cyber/80 hover:text-white backdrop-blur-md transition-colors"
          >
            <Send size={11} />
          </button>

          {/* Delete */}
          <button
            onClick={onDelete}
            title="Delete asset"
            className="grid h-7 w-7 place-items-center rounded-lg bg-black/50 text-muted-foreground hover:bg-crimson/80 hover:text-white backdrop-blur-md transition-colors"
          >
            <Trash2 size={11} />
          </button>
        </div>

        <div className="absolute bottom-0 inset-x-0 p-3">
          <div className="text-xs font-medium truncate">{name}</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <Hash size={9} /> {hash.slice(0, 16)}…
          </div>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-border flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={10} />
          {new Date(uploadedAt).toLocaleDateString()}
        </span>
        <span className={leaked ? "text-crimson" : "text-emerald"}>
          {leaked ? "● ALERT" : "● SAFE"}
        </span>
      </div>
    </motion.div>
  );
}
