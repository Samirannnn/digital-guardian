import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  AlertOctagon,
  Globe2,
  Boxes,
  Cpu,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { ResultView } from "@/components/dashboard/ResultView";
import { GlobalAlertsFeed } from "@/components/dashboard/GlobalAlertsFeed";
import { simulateBlockchainCheck, type ScanResult } from "@/lib/dna";
import { vault, useVault } from "@/lib/vault";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sentinel — Digital Asset Protection Dashboard" },
      {
        name: "description",
        content:
          "Protect your media with on-chain pHash signatures and detect unauthorized redistribution across the Android network in real time.",
      },
      { property: "og:title", content: "Sentinel — Digital Asset Protection" },
      {
        property: "og:description",
        content:
          "On-chain pHash signatures + global leak detection for creators.",
      },
    ],
  }),
  component: OverviewPage,
});

const stages = [
  "Reading EXIF & color matrix…",
  "Computing perceptual hash (pHash)…",
  "Querying Polygon ledger nodes…",
  "Cross-referencing 1,284 Android beacons…",
  "Compiling distribution report…",
];

function OverviewPage() {
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(stages[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const items = useVault();

  useEffect(() => {
    if (!scanning) return;
    setProgress(0);
    const start = Date.now();
    const t = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(99, Math.floor((elapsed / 3000) * 100));
      setProgress(pct);
      const idx = Math.min(stages.length - 1, Math.floor(pct / 20));
      setStage(stages[idx]);
    }, 80);
    return () => clearInterval(t);
  }, [scanning]);

  const handleFile = async (file: File) => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResult(null);
    setScanning(true);

    // TODO: Connect to Polygon/Smart Contract here
    const r = await simulateBlockchainCheck(file);

    setProgress(100);
    setTimeout(() => {
      setScanning(false);
      setResult(r);
      vault.add({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        result: r,
      });
    }, 250);
  };

  const totalLeaks = items.reduce(
    (n, i) => n + (i.result.status === "leaked" ? i.result.locations.length : 0),
    0,
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Digital DNA · Overview
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Welcome back, <span className="text-gradient-primary">Souhrid</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalLeaks > 0
              ? `${totalLeaks} active leak${totalLeaks > 1 ? "s" : ""} detected across the Android network.`
              : "Your protected library is clean. Drop a new asset below to register its signature."}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            label="Protected Assets"
            value={String(248 + items.length)}
            delta={`+${items.length || 12} this week`}
            icon={Boxes}
            accent="primary"
            index={0}
          />
          <StatCard
            label="Active Leaks"
            value={String(7 + totalLeaks)}
            delta={`+${totalLeaks || 2} new`}
            trend="down"
            icon={AlertOctagon}
            accent="crimson"
            index={1}
          />
          <StatCard
            label="Global Shares Tracked"
            value="14.2K"
            delta="+312 / 24h"
            icon={Globe2}
            accent="cyber"
            index={2}
          />
          <StatCard
            label="Blockchain Sync"
            value="100%"
            delta="Polygon · 18ms"
            icon={Cpu}
            accent="emerald"
            index={3}
          />
        </div>

        {/* Main grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <AnimatePresence mode="wait">
              {result && imageUrl ? (
                <ResultView
                  key="result"
                  imageUrl={imageUrl}
                  result={result}
                  onClose={() => {
                    setResult(null);
                    setImageUrl(null);
                  }}
                />
              ) : (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <UploadZone
                    onFile={handleFile}
                    scanning={scanning}
                    progress={progress}
                    stage={stage}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recent uploads strip */}
            <RecentStrip />
          </div>

          {/* Right column */}
          <div className="lg:col-span-1">
            <GlobalAlertsFeed />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function RecentStrip() {
  const items = useVault().slice(0, 6);
  if (items.length === 0) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Recent Scans</h3>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {items.length} items
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {items.map((it) => {
          const leaked = it.result.status === "leaked";
          return (
            <div key={it.id} className="relative aspect-square rounded-lg overflow-hidden group">
              <img src={it.url} alt={it.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
              <div
                className={`absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full ${
                  leaked ? "bg-crimson/90 glow-crimson" : "bg-emerald/90 glow-emerald"
                }`}
              >
                {leaked ? (
                  <AlertOctagon size={10} className="text-white" />
                ) : (
                  <ShieldCheck size={10} className="text-white" />
                )}
              </div>
              <div className="absolute bottom-1 inset-x-1 text-[9px] font-mono text-white/80 truncate">
                {it.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
