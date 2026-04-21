import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useVault } from "@/lib/vault";
import { ShieldCheck, AlertOctagon, FolderLock, Hash, Calendar } from "lucide-react";
import { motion } from "framer-motion";

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

// Seed assets so the page never feels empty for the demo
const seed = [
  { name: "campaign_poster_v3.jpg", status: "leaked" as const, hue: 230 },
  { name: "product_render_001.png", status: "clean" as const, hue: 160 },
  { name: "behind_the_scenes.jpg", status: "clean" as const, hue: 280 },
  { name: "whatsapp_test_photo.jpg", status: "leaked" as const, hue: 20 },
  { name: "logo_concept_b.png", status: "clean" as const, hue: 200 },
  { name: "model_shoot_final.jpg", status: "leaked" as const, hue: 340 },
  { name: "brand_assets_pack.png", status: "clean" as const, hue: 120 },
  { name: "promo_banner_x.jpg", status: "clean" as const, hue: 60 },
];

function VaultPage() {
  const real = useVault();

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
          <p className="mt-1 text-sm text-muted-foreground">
            Every asset is fingerprinted and anchored on-chain. Click any item to inspect its signature.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {real.map((it, i) => (
            <VaultCard
              key={it.id}
              name={it.name}
              status={it.result.status}
              uploadedAt={it.uploadedAt}
              hash={it.result.hash}
              imageUrl={it.url}
              index={i}
            />
          ))}
          {seed.map((s, i) => (
            <VaultCard
              key={s.name}
              name={s.name}
              status={s.status}
              uploadedAt={new Date(Date.now() - (i + 1) * 86400000).toISOString()}
              hash={Array.from({ length: 64 }, () =>
                Math.floor(Math.random() * 16).toString(16),
              ).join("")}
              gradientHue={s.hue}
              index={real.length + i}
            />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}

type CardProps = {
  name: string;
  status: "clean" | "leaked";
  uploadedAt: string;
  hash: string;
  imageUrl?: string;
  gradientHue?: number;
  index: number;
};

function VaultCard({ name, status, uploadedAt, hash, imageUrl, gradientHue = 220, index }: CardProps) {
  const leaked = status === "leaked";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
      className="glass rounded-xl overflow-hidden group hover:ring-1 hover:ring-primary/40 transition-all"
    >
      <div className="relative aspect-square">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(circle at 30% 30%, oklch(0.6 0.18 ${gradientHue}) 0%, oklch(0.25 0.08 ${gradientHue}) 70%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

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
