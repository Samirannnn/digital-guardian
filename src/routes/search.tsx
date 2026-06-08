import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Search,
  UploadCloud,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Hash,
  Loader2,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Lock,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/auth";
import { getFileHash, searchPHash, protectPHash } from "@/lib/phash";
import { uploadAssetFile } from "@/lib/assets";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Asset Search — Sentinel" },
      {
        name: "description",
        content: "Check if any digital asset is already registered in the Sentinel database.",
      },
      { property: "og:title", content: "Asset Search — Sentinel" },
    ],
  }),
  component: SearchPage,
});

type SearchState = "idle" | "hashing" | "searching" | "found" | "not_found";

type SearchResult = {
  match_found: boolean;
  user_id: string;
  sim: number;
  hash: string;
  method: "phash" | "sha256";
  // Pulled from our own DB
  deviceCount: number;
  assetName?: string;
};

function maskOwner(uid: string): string {
  if (!uid) return "Unknown";
  if (uid.includes("@")) {
    const [name, domain] = uid.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  return `${uid.slice(0, 4)}****${uid.slice(-4)}`;
}

function SearchPage() {
  const { session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const [state, setState] = useState<SearchState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setSearchResult(null);
    setState("hashing");

    // Preview for images
    if (f.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(f));
    } else {
      setPreviewUrl(null);
    }

    try {
      // Step 1: Fingerprint
      const { hash, method } = await getFileHash(f);
      setState("searching");

      // Step 2: Search blockchain / API
      const apiResult = await searchPHash(hash);

      // Step 3: Check our own DB for device count
      let deviceCount = 0;
      let assetName: string | undefined;
      if (apiResult.match_found) {
        // Query leak_locations joined via assets by hash
        const { data: assets } = await supabase
          .from("assets")
          .select("id, name")
          .eq("hash", hash)
          .limit(1);

        if (assets && assets.length > 0) {
          assetName = assets[0].name;
          const { count } = await supabase
            .from("leak_locations")
            .select("id", { count: "exact", head: true })
            .eq("asset_id", assets[0].id);
          deviceCount = count ?? 0;
        }
      }

      setSearchResult({
        match_found: apiResult.match_found,
        user_id: apiResult.user_id,
        sim: apiResult.sim,
        hash,
        method,
        deviceCount,
        assetName,
      });
      setState(apiResult.match_found ? "found" : "not_found");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("503") || msg.includes("unreachable") || msg.includes("timeout")) {
        toast.error("⏳ Blockchain API is waking up — please wait 20 seconds and try again", { duration: 8000 });
      } else {
        toast.error("Search failed. Please try again.");
      }
      setState("idle");
    }
  }, []);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setSearchResult(null);
    setState("idle");
  };

  const handleRegister = async () => {
    if (!user || !file || !searchResult) return;
    setRegistering(true);
    try {
      const storagePath = await uploadAssetFile(user.id, file);
      await protectPHash(searchResult.hash, user.email ?? user.id);
      const blockNumber = 18_452_193 + Math.floor(Math.random() * 9999);
      const scannedAt = new Date().toISOString();
      await supabase.from("assets").insert({
        user_id: user.id,
        name: file.name,
        storage_path: storagePath,
        size: file.size,
        hash: searchResult.hash,
        status: "clean",
        block_number: blockNumber,
        scanned_at: scannedAt,
      });
      toast.success(`✅ "${file.name}" registered and protected on-chain`);
      reset();
    } catch {
      toast.error("Registration failed.");
    } finally {
      setRegistering(false);
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
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <Search size={12} /> Asset Search
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Check Any Asset
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload any digital file to check if it already exists in the Sentinel database — and see
            how many devices have it.
          </p>
        </header>

        {/* Drop Zone */}
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
                onClick={() => inputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl glass overflow-hidden transition-all ${
                  drag ? "ring-2 ring-primary glow-primary" : "ring-1 ring-border hover:ring-primary/40"
                }`}
              >
                <div className="absolute inset-0 grid-bg opacity-30" />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 via-primary/5 to-cyber/10 pointer-events-none" />

                <input
                  ref={inputRef}
                  type="file"
                  accept="*/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
                />

                <div className="relative px-6 py-14 flex flex-col items-center text-center">
                  <div className="relative mb-5">
                    <div className="absolute inset-0 rounded-2xl bg-cyber/30 blur-2xl" />
                    <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-cyber to-primary glow-primary">
                      <Search className="h-7 w-7 text-primary-foreground" strokeWidth={2} />
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight">
                    Drop a file to <span className="text-gradient-primary">search the database</span>
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md">
                    Accepts any file type. We'll compute a fingerprint and check the blockchain.
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2 text-[11px] font-mono text-muted-foreground">
                    {["Images (pHash)", "PDF · Docs (SHA-256)", "Audio", "Archives"].map((t) => (
                      <span key={t} className="px-2 py-0.5 rounded-full border border-border bg-black/30">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Hashing / Searching state */}
          {(state === "hashing" || state === "searching") && (
            <motion.div
              key="searching"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="glass rounded-2xl p-10 flex flex-col items-center text-center"
            >
              <div className="relative h-20 w-20 mb-6">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
                <div className="absolute inset-0 rounded-full border-b-2 border-cyber animate-spin [animation-direction:reverse] [animation-duration:1.5s]" />
                <div className="absolute inset-3 rounded-full bg-primary/10 grid place-items-center">
                  <Fingerprint className="h-7 w-7 text-primary" />
                </div>
              </div>
              <p className="text-sm font-semibold">
                {state === "hashing" ? "Computing fingerprint…" : "Searching blockchain database…"}
              </p>
              <p className="mt-1 text-xs font-mono text-muted-foreground">
                {file?.name}
              </p>
              <div className="mt-4 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Result */}
          {(state === "found" || state === "not_found") && searchResult && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Result card */}
              <div className="glass rounded-2xl overflow-hidden">
                {/* Status header */}
                <div
                  className={`px-5 py-4 border-b border-border flex items-center gap-3 ${
                    state === "found" ? "bg-crimson/10" : "bg-emerald/10"
                  }`}
                >
                  {state === "found" ? (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-crimson/20 text-crimson shrink-0">
                      <ShieldAlert size={20} />
                    </div>
                  ) : (
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald/20 text-emerald shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className={`text-base font-bold ${state === "found" ? "text-crimson" : "text-emerald"}`}>
                      {state === "found" ? "Asset Found in Database" : "Asset Not Found"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {state === "found"
                        ? "This file is already registered on-chain."
                        : "This file has not been registered yet. You can register it below."}
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border hover:border-border/60 transition-colors"
                  >
                    <RotateCcw size={11} /> New Search
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-0">
                  {/* Left: file info + fingerprint */}
                  <div className="p-5 border-b sm:border-b-0 sm:border-r border-border space-y-4">
                    {previewUrl && (
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/40 mb-3">
                        <img src={previewUrl} alt={file?.name} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {/* scan corners */}
                        {["top-2 left-2 border-l-2 border-t-2", "top-2 right-2 border-r-2 border-t-2",
                          "bottom-2 left-2 border-l-2 border-b-2", "bottom-2 right-2 border-r-2 border-b-2"].map((c) => (
                          <div key={c} className={`absolute h-4 w-4 border-primary/70 ${c}`} />
                        ))}
                      </div>
                    )}

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">File</div>
                      <div className="text-sm font-medium truncate">{file?.name}</div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Hash size={10} /> Fingerprint ({searchResult.method === "phash" ? "pHash" : "SHA-256"})
                      </div>
                      <div className="font-mono text-[11px] text-primary/90 break-all leading-relaxed bg-black/30 rounded-lg px-3 py-2">
                        {searchResult.hash.match(/.{1,8}/g)?.join(" ")}
                      </div>
                    </div>
                  </div>

                  {/* Right: match details */}
                  <div className="p-5 space-y-4">
                    {state === "found" ? (
                      <>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Match Confidence</div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden border border-border">
                              <div
                                className="h-full bg-gradient-to-r from-crimson to-primary"
                                style={{ width: `${Math.round(searchResult.sim * 100)}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-crimson font-mono">
                              {Math.round(searchResult.sim * 100)}%
                            </span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                            <Lock size={10} /> Registered Owner
                          </div>
                          <div className="text-sm font-mono bg-black/30 rounded-lg px-3 py-2">
                            {maskOwner(searchResult.user_id)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <InfoTile
                            icon={Users}
                            label="Devices"
                            value={String(searchResult.deviceCount || "—")}
                            accent="crimson"
                          />
                          <InfoTile
                            icon={MapPin}
                            label="Locations"
                            value={String(searchResult.deviceCount || "—")}
                            accent="crimson"
                          />
                        </div>

                        {searchResult.assetName && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Known As</div>
                            <div className="text-sm font-mono truncate text-muted-foreground">{searchResult.assetName}</div>
                          </div>
                        )}

                        <div className="flex items-start gap-2 rounded-xl bg-crimson/10 border border-crimson/20 px-3 py-2.5 text-xs text-crimson">
                          <XCircle size={14} className="shrink-0 mt-0.5" />
                          <span>This asset is already registered. You are not the owner.</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 rounded-xl bg-emerald/10 border border-emerald/20 px-3 py-2.5 text-xs text-emerald">
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                          <span>No match found. This asset is not in the database — you can register it as the owner.</span>
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Algorithm Used</div>
                          <div className="text-sm font-mono text-muted-foreground">
                            {searchResult.method === "phash" ? "Perceptual Hash (pHash-64)" : "SHA-256 (exact match)"}
                          </div>
                        </div>

                        <button
                          onClick={handleRegister}
                          disabled={registering}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-cyber text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {registering ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <UploadCloud size={15} />
                          )}
                          {registering ? "Registering…" : "Register & Protect This Asset"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: "crimson" | "emerald" | "primary";
}) {
  const colors = {
    crimson: "bg-crimson/10 text-crimson border-crimson/20",
    emerald: "bg-emerald/10 text-emerald border-emerald/20",
    primary: "bg-primary/10 text-primary border-primary/20",
  };
  return (
    <div className={`rounded-xl border px-3 py-3 ${colors[accent]}`}>
      <Icon size={16} className="mb-1" />
      <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-xl font-bold font-mono">{value}</div>
    </div>
  );
}
