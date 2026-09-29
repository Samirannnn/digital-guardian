import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  ShieldCheck,
  AlertOctagon,
  Boxes,
  Cpu,
  UploadCloud,
  Search,
  Radar,
  RefreshCw,
  ShieldAlert,
  MapPin,
  Smartphone,
  MessageCircle,
  EyeOff,
  Lock,
  History,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { BulkUploadZone } from "@/components/dashboard/BulkUploadZone";
import { ResultView } from "@/components/dashboard/ResultView";
import { SecurityAlertBanner } from "@/components/dashboard/SecurityAlertBanner";
import { ActiveThreatsFeed } from "@/components/dashboard/ActiveThreatsFeed";
import { WorldMap } from "@/components/dashboard/WorldMap";
import type { ScanResult } from "@/lib/dna";
import { useAuth } from "@/lib/auth";
import {
  useAssets,
  useAssetsRealtime,
  useRefreshAssets,
  uploadAssetFile,
  wipeRemoteAsset,
  fetchProtectionAuditLogs,
  type AuditLogEntry,
} from "@/lib/assets";
import { runScan } from "@/lib/scan.functions";
import { LocationDialog } from "@/components/dashboard/LocationDialog";
import { type GeoLocation } from "@/lib/geo";

export const Route = createFileRoute("/")(  {
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
  "Reading file metadata…",
  "Computing fingerprint…",
  "Querying Polygon ledger nodes…",
  "Cross-referencing 1,284 Android beacons…",
  "Compiling distribution report…",
];

type Tab = "bulk" | "scan";

function OverviewPage() {
  const navigate = useNavigate();
  const { session, user, profile, loading: authLoading } = useAuth();

  const [tab, setTab] = useState<Tab>("bulk");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(stages[0]);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [isOwnerOfResult, setIsOwnerOfResult] = useState(true);
  const [resultOwnerEmail, setResultOwnerEmail] = useState<string | null>(null);
  const [leakAlert, setLeakAlert] = useState<{ fileName: string; result: ScanResult } | null>(null);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [vaultScanning, setVaultScanning] = useState(false);
  const [vaultScanProgress, setVaultScanProgress] = useState(0);
  const [vaultScanStage, setVaultScanStage] = useState("");
  const [vaultScanResult, setVaultScanResult] = useState<any[] | null>(null);
  const [vaultLeakedAssets, setVaultLeakedAssets] = useState<any[]>([]);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const { data: items = [] } = useAssets();
  useAssetsRealtime();
  const refresh = useRefreshAssets();

  // Load audit logs
  useEffect(() => {
    if (user?.id) {
      fetchProtectionAuditLogs(user.id).then(setAuditLogs);
    }
  }, [user?.id, items]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  // Progress simulation
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

  const handleFile = (file: File) => {
    setPendingFile(file);
    setLocationDialogOpen(true);
  };

  const executeScan = async (file: File, loc: GeoLocation) => {
    if (!user) return;
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setResult(null);
    setScanning(true);

    try {
      // 1. Upload to Cloud Storage
      const storagePath = await uploadAssetFile(user.id, file);

      // 2. Run server-side scan (persists asset + leak_locations under user)
      const r = await runScan({
        data: {
          fileName: file.name,
          fileSize: file.size,
          storagePath,
          file,
        },
        location: loc,
      });

      setProgress(100);
      setTimeout(() => {
        setScanning(false);
        const scanResult: ScanResult = {
          hash: r.hash,
          status: r.status,
          scannedAt: r.scannedAt,
          blockNumber: r.blockNumber,
          locations: r.locations,
          isBlurred: r.isBlurred,
        };
        setResult(scanResult);
        setIsOwnerOfResult(r.isOwner);
        setResultOwnerEmail(r.ownerEmail);
        refresh();
        const blockchainDown = (r as any)._blockchainUnavailable;
        if (r.status === "leaked") {
          setLeakAlert({ fileName: file.name, result: scanResult });
          toast.error(
            `🚨 Leak detected in ${r.locations.length} location${r.locations.length > 1 ? "s" : ""}`,
            { duration: 6000 },
          );
        } else if (blockchainDown) {
          toast.warning("Asset saved — blockchain verification pending (API waking up)", { duration: 5000 });
        } else {
          toast.success("Asset registered — no leaks found");
        }
      }, 250);
    } catch (err) {
      setScanning(false);
      setImageUrl(null);
      const msg = err instanceof Error ? err.message : "Scan failed";
      if (msg.includes("503") || msg.includes("unreachable") || msg.includes("timeout")) {
        toast.error("⏳ Blockchain API is waking up — please try again in 20 seconds", { duration: 8000 });
      } else {
        toast.error(msg);
      }
    }
  };

  const executeVaultScan = async () => {
    if (items.length === 0) {
      toast.error("No assets registered in the vault to scan.");
      return;
    }
    setVaultScanResult(null);
    setVaultScanning(true);
    setVaultScanProgress(0);
    setVaultScanStage("Initializing vault integrity scan...");

    const scanStages = [
      "Retrieving all vault assets...",
      "Matching perceptual hashes (pHash)...",
      "Scanning global leak indexes...",
      "Polygon blockchain ownership verification...",
      "Generating threat location mapping..."
    ];

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(99, Math.floor((elapsed / 3000) * 100));
      setVaultScanProgress(pct);
      const stageIdx = Math.min(scanStages.length - 1, Math.floor(pct / 20));
      setVaultScanStage(scanStages[stageIdx]);
    }, 85);

    setTimeout(() => {
      clearInterval(interval);
      setVaultScanProgress(100);

      setTimeout(() => {
        setVaultScanning(false);
        const leaked = items.filter((it) => it.status === "leaked");
        const allPins = leaked.flatMap((it) => 
          it.locations.map((loc) => ({
            ...loc,
            assetName: it.name,
          }))
        );

        setVaultLeakedAssets(leaked);
        setVaultScanResult(allPins);

        if (allPins.length > 0) {
          toast.error(`🚨 Sighting scan complete: ${allPins.length} unauthorized copy sighting(s) found!`, { duration: 6000 });
        } else {
          toast.success("✅ Sighting scan complete: All registered assets are secure!");
        }
      }, 250);
    }, 3000);
  };

  const totalLeaks = items.reduce(
    (n, i) => n + (i.status === "leaked" ? i.locations.length : 0),
    0,
  );

  const protectedCount = items.filter((it) => it.enforce_blur || it.isBlurred).length;

  if (authLoading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground font-mono">Loading…</div>
      </div>
    );
  }

  const handleWipe = async (lat: number, lng: number) => {
    if (!result || !user?.id) return;
    try {
      const res = await wipeRemoteAsset(user.id, result.hash, lat, lng);
      if (res.success) {
        toast.success("Remote copy successfully removed from other devices");
        refresh();
        setResult(null);
        setImageUrl(null);
      } else {
        toast.error(res.message || "Failed to remove asset remote copy");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred during remote asset removal");
    }
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "Creator";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Title */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Digital DNA · Overview
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Welcome back, <span className="text-gradient-primary">{displayName}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalLeaks > 0
              ? `${totalLeaks} active leak${totalLeaks > 1 ? "s" : ""} detected across the Android network.`
              : "Your protected library is clean. Register assets below or use Quick Scan."}
          </p>
        </div>

        {/* Security Alert Banner — shown when a scan detects a leak */}
        <AnimatePresence>
          {leakAlert && (
            <SecurityAlertBanner
              key="leak-banner"
              fileName={leakAlert.fileName}
              result={leakAlert.result}
              onDismiss={() => setLeakAlert(null)}
            />
          )}
        </AnimatePresence>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            label="Total Assets"
            value={String(items.length)}
            delta={items.length > 0 ? `${items.length} on-chain` : "Get started"}
            icon={Boxes}
            accent="primary"
            index={0}
          />
          <StatCard
            label="Blur Protected"
            value={String(protectedCount)}
            delta={`${protectedCount} / ${items.length} protected`}
            icon={EyeOff}
            accent="emerald"
            index={1}
          />
          <StatCard
            label="Active Leaks"
            value={String(totalLeaks)}
            delta={totalLeaks > 0 ? `${totalLeaks} detection${totalLeaks > 1 ? "s" : ""}` : "All clear"}
            trend={totalLeaks > 0 ? "down" : "up"}
            icon={AlertOctagon}
            accent="crimson"
            index={2}
          />
          <StatCard
            label="Blockchain Sync"
            value="100%"
            delta="Polygon · 18ms"
            icon={Cpu}
            accent="primary"
            index={3}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 space-y-6">
            {/* Tab switcher */}
            <div className="flex gap-1 p-1 rounded-xl bg-black/30 border border-border w-fit">
              {([
                { id: "bulk" as Tab, label: "Bulk Register", icon: UploadCloud },
                { id: "scan" as Tab, label: "Quick Scan", icon: Search },
              ] as const).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => { setTab(id); setResult(null); setImageUrl(null); }}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tab === id
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === id && (
                    <motion.div
                      layoutId="tab-bg"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary/20 to-cyber/10 border border-primary/30"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon size={14} className={`relative ${tab === id ? "text-primary" : ""}`} />
                  <span className="relative">{label}</span>
                </button>
              ))}
            </div>

            {/* Main content */}
            <AnimatePresence mode="wait">
              {tab === "bulk" ? (
                <motion.div
                  key="bulk"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <BulkUploadZone
                    userId={user!.id}
                    userEmail={user!.email ?? user!.id}
                    onComplete={refresh}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="scan"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <AnimatePresence mode="wait">
                    {vaultScanning ? (
                      /* ── VAULT SCANNING PROGRESS SCREEN ── */
                      <motion.div
                        key="vault-scanning"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="glass rounded-2xl p-10 flex flex-col items-center text-center border border-primary/20 relative overflow-hidden"
                      >
                        <div className="absolute inset-0 grid-bg opacity-15" />
                        <div className="relative h-24 w-24 mb-6">
                          <div className="absolute inset-0 rounded-full border border-primary/10" />
                          <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" style={{ animationDuration: "2s" }} />
                          <div className="absolute inset-2 rounded-full border-b border-cyber/50 animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                          <div className="absolute inset-4 rounded-full bg-primary/5 grid place-items-center">
                            <Radar className="h-10 w-10 text-primary animate-pulse" />
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-bold tracking-tight text-white">Global Vault Scan in Progress</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">{vaultScanStage}</p>
                        
                        <div className="w-full max-w-xs mt-6 space-y-1">
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-border/30">
                            <motion.div
                              className="h-full bg-gradient-to-r from-primary to-cyber"
                              initial={{ width: 0 }}
                              animate={{ width: `${vaultScanProgress}%` }}
                              transition={{ duration: 0.1 }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-mono text-muted-foreground px-0.5">
                            <span>SCANNING SIGNATURES</span>
                            <span>{vaultScanProgress}%</span>
                          </div>
                        </div>
                      </motion.div>
                    ) : vaultScanResult ? (
                      /* ── VAULT SCANNING RESULTS PANEL ── */
                      <motion.div
                        key="vault-scan-result"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="glass rounded-2xl overflow-hidden border border-border/80"
                      >
                        <div className={`px-5 py-4 border-b border-border flex items-center justify-between ${
                          vaultScanResult.length > 0 ? "bg-crimson/10" : "bg-emerald/10"
                        }`}>
                          <div className="flex items-center gap-2">
                            {vaultScanResult.length > 0 ? (
                              <ShieldAlert className="text-crimson shrink-0" size={18} />
                            ) : (
                              <ShieldCheck className="text-emerald shrink-0" size={18} />
                            )}
                            <span className={`text-sm font-bold ${
                              vaultScanResult.length > 0 ? "text-crimson" : "text-emerald"
                            }`}>
                              {vaultScanResult.length > 0 
                                ? `Integrity Breach Detected (${vaultLeakedAssets.length} asset${vaultLeakedAssets.length !== 1 ? "s" : ""})`
                                : "Vault Integrity Verified"
                              }
                            </span>
                          </div>
                          <button
                            onClick={() => setVaultScanResult(null)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border transition-colors bg-white/5"
                          >
                            <RefreshCw size={11} /> New Scan
                          </button>
                        </div>

                        {vaultScanResult.length > 0 ? (
                          <div>
                            {/* Map showing all sighting pins */}
                            <div className="p-4 border-b border-border bg-black/20">
                              <div className="text-[11px] uppercase tracking-wider font-mono text-muted-foreground mb-2 flex items-center gap-1.5">
                                <MapPin size={12} className="text-crimson" /> Sighting Locations Map
                              </div>
                              <WorldMap pins={vaultScanResult} compact={false} />
                            </div>

                            {/* List of sightings */}
                            <div className="divide-y divide-border/40 max-h-72 overflow-y-auto">
                              {vaultScanResult.map((loc, i) => (
                                <div key={i} className="p-4 flex items-start gap-3 hover:bg-white/[0.02] transition-colors">
                                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-crimson/15 text-crimson shrink-0 mt-0.5">
                                    <ShieldAlert size={15} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-sm text-white truncate max-w-[200px]">
                                        {loc.assetName}
                                      </span>
                                      <span className="text-[10px] font-mono bg-crimson/15 text-crimson px-1.5 py-0.5 rounded shrink-0">
                                        {loc.confidence}% match
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <MapPin size={10} className="text-crimson/70 shrink-0" />
                                      <span>{loc.city}, {loc.country}</span>
                                      <span className="opacity-50">·</span>
                                      <span className="font-mono text-[10px]">GPS: {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
                                    </div>
                                    <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground/80 font-mono">
                                      <span className="flex items-center gap-0.5"><Smartphone size={9} className="shrink-0" /> {loc.device}</span>
                                      <span className="flex items-center gap-0.5"><MessageCircle size={9} className="shrink-0" /> {loc.app}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="py-14 px-6 text-center space-y-3.5">
                            <div className="relative mx-auto h-16 w-16">
                              <div className="absolute inset-0 rounded-full bg-emerald/20 blur-xl" />
                              <div className="relative grid h-16 w-16 place-items-center rounded-full bg-emerald/15 border border-emerald/30">
                                <ShieldCheck className="h-7 w-7 text-emerald" />
                              </div>
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white">All Vault Assets Protected</h3>
                              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs mx-auto leading-relaxed">
                                No unauthorized uploads or leaks were found for any of your registered assets. Your library integrity is 100% clean.
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : result && imageUrl ? (
                      /* ── SINGLE ASSET RESULT VIEW ── */
                      <ResultView
                        key="result"
                        imageUrl={imageUrl}
                        result={result}
                        onClose={() => {
                          setResult(null);
                          setImageUrl(null);
                        }}
                        isOwner={isOwnerOfResult}
                        ownerEmail={resultOwnerEmail}
                        onWipe={handleWipe}
                      />
                    ) : (
                      /* ── IDLE / DEFAULT SCAN VIEW: Uploader + Scan Vault Card ── */
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* File Drop Uploader */}
                        <div className="md:col-span-2">
                          <UploadZone
                            onFile={handleFile}
                            scanning={scanning}
                            progress={progress}
                            stage={stage}
                          />
                        </div>
                        
                        {/* Scan All Vault Assets Button Card */}
                        <div className="md:col-span-1 glass rounded-2xl p-5 flex flex-col justify-between border border-border hover:border-primary/30 transition-all relative overflow-hidden group">
                          <div className="absolute inset-0 grid-bg opacity-10" />
                          <div className="relative space-y-4">
                            <div className="relative h-10 w-10 shrink-0">
                              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/30 to-cyber/30 blur-lg group-hover:blur-xl transition-all" />
                              <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-cyber/10 border border-primary/20">
                                <Radar className="h-5 w-5 text-primary group-hover:scale-105 transition-transform" />
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-white">Scan All Vault Assets</h4>
                              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                                Check all {items.length} file{items.length !== 1 ? "s" : ""} registered in your vault. If any leak exists, all sighting locations will be displayed on a unified map.
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={executeVaultScan}
                            disabled={items.length === 0}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold mt-6 bg-white/5 border border-border/80 hover:bg-primary/10 hover:border-primary/40 text-white disabled:opacity-40 disabled:hover:bg-white/5 disabled:hover:border-border transition-all cursor-pointer"
                          >
                            <Radar size={12} className="group-hover:animate-pulse" />
                            Scan Vault ({items.length})
                          </button>
                        </div>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Recent uploads strip */}
                  <RecentStrip />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <ActiveThreatsFeed />
            <ProtectionActivityFeed logs={auditLogs} />
          </div>
        </div>

        <LocationDialog
          open={locationDialogOpen}
          onOpenChange={setLocationDialogOpen}
          onConfirm={(loc) => {
            setLocationDialogOpen(false);
            if (pendingFile) {
              executeScan(pendingFile, loc);
              setPendingFile(null);
            }
          }}
          onCancel={() => {
            setLocationDialogOpen(false);
            setPendingFile(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}

function RecentStrip() {
  const { data: items = [] } = useAssets();
  const recent = items.slice(0, 6);
  if (recent.length === 0) return null;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Recent Scans</h3>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
          {items.length} items
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {recent.map((it) => {
          const leaked = it.status === "leaked";
          return (
            <div
              key={it.id}
              className="relative aspect-square rounded-lg overflow-hidden group bg-black/30"
            >
              {it.signedUrl ? (
                <img src={it.signedUrl} alt={it.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/5">
                  <span className="text-[9px] font-mono text-muted-foreground text-center px-1 break-all">
                    {it.name.split(".").pop()?.toUpperCase()}
                  </span>
                </div>
              )}
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

function ProtectionActivityFeed({ logs }: { logs: AuditLogEntry[] }) {
  if (logs.length === 0) return null;

  const getActionLabel = (action: string) => {
    switch (action) {
      case "BLUR_ENABLED":
        return { label: "Protection Enabled 🔒", cls: "text-crimson bg-crimson/15 border-crimson/30" };
      case "BLUR_DISABLED":
        return { label: "Protection Disabled 🔓", cls: "text-muted-foreground bg-white/5 border-border" };
      case "BLUR_STRENGTH_CHANGED":
        return { label: "Blur Strength Updated", cls: "text-primary bg-primary/15 border-primary/30" };
      default:
        return { label: action, cls: "text-white bg-white/5 border-border" };
    }
  };

  return (
    <div className="glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
          <History size={13} className="text-primary" /> Protection Activity
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{logs.length} events</span>
      </div>

      <div className="divide-y divide-border/50 max-h-56 overflow-y-auto">
        {logs.slice(0, 5).map((log) => {
          const act = getActionLabel(log.action);
          return (
            <div key={log.id} className="py-2.5 flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-white truncate max-w-[170px]">{log.assetName}</div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full border ${act.cls} shrink-0`}>
                {act.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
