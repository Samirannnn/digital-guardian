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
  Copy,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { WorldMap } from "@/components/dashboard/WorldMap";
import { useAuth } from "@/lib/auth";
import { getFileHash, transferOwnership } from "@/lib/phash";
import { lookupHashInDB, uploadAssetFile, transferOwnershipDB } from "@/lib/assets";
import { supabase } from "@/integrations/supabase/client";
import type { HashLookupResult } from "@/lib/assets";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Asset Search — Sentinel" },
      { name: "description", content: "Check if any digital asset is already registered in the Sentinel database." },
      { property: "og:title", content: "Asset Search — Sentinel" },
    ],
  }),
  component: SearchPage,
});

type SearchState = "idle" | "hashing" | "searching" | "found" | "not_found";

function maskEmail(email: string | null): string {
  if (!email) return "Unknown";
  if (email.includes("@")) {
    const [name, domain] = email.split("@");
    return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
  }
  return `${email.slice(0, 4)}****${email.slice(-4)}`;
}

function SearchPage() {
  const { session, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const [state, setState] = useState<SearchState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [hashMethod, setHashMethod] = useState<"phash" | "sha256">("phash");
  const [searchResult, setSearchResult] = useState<HashLookupResult | null>(null);
  const [registering, setRegistering] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  useEffect(() => {
    if (!authLoading && !session) navigate({ to: "/auth" });
  }, [authLoading, session, navigate]);

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setSearchResult(null);
    setHash(null);
    setState("hashing");

    if (f.type.startsWith("image/")) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl(null);

    try {
      // Step 1: Fingerprint
      const result = await getFileHash(f);
      setHash(result.hash);
      setHashMethod(result.method);
      setState("searching");

      // Step 2: Query Supabase directly — reliable, no blockchain dependency
      const dbResult = await lookupHashInDB(result.hash);
      setSearchResult(dbResult);
      setState(dbResult.found ? "found" : "not_found");
    } catch (err) {
      toast.error("Search failed. Please try again.");
      setState("idle");
    }
  }, []);

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setSearchResult(null);
    setHash(null);
    setState("idle");
  };

  const handleRegister = async () => {
    if (!user || !file || !hash) return;
    setRegistering(true);
    try {
      const storagePath = await uploadAssetFile(user.id, file);
      const blockNumber = 18_452_193 + Math.floor(Math.random() * 9999);
      const { error } = await supabase.from("assets").insert({
        user_id: user.id,
        name: file.name,
        storage_path: storagePath,
        size: file.size,
        hash,
        status: "clean",
        block_number: blockNumber,
        scanned_at: new Date().toISOString(),
        app_email: user.email ?? user.id,
      });
      if (error) throw error;
      toast.success(`✅ "${file.name}" registered — you are now the owner`);
      reset();
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const handleTransfer = async () => {
    if (!hash || !user?.email || !transferEmail.trim() || !searchResult) return;
    setIsTransferring(true);
    try {
      // 1. Blockchain API transfer (non-fatal)
      try {
        await transferOwnership(hash, user.email, transferEmail.trim());
      } catch (e) {
        console.warn("Blockchain transfer API failed:", e);
      }

      // 2. DB transfer (primary source of truth)
      const dbResult = await transferOwnershipDB(hash, transferEmail.trim());
      if (dbResult.success) {
        toast.success(`✅ Ownership transferred to ${transferEmail}`);
        // Refresh lookup result
        const refreshed = await lookupHashInDB(hash);
        setSearchResult(refreshed);
        setTransferEmail("");
      } else {
        toast.error(dbResult.message || "Database transfer failed.");
      }
    } catch {
      toast.error("Transfer request failed.");
    } finally {
      setIsTransferring(false);
    }
  };

  const copyHash = () => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (authLoading || !session) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground font-mono">Loading…</div>
      </div>
    );
  }

  const isCurrentUserOwner =
    searchResult?.ownerUserId === user?.id || searchResult?.ownerEmail === user?.email;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <Search size={12} /> Asset Search
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">Check Any Asset</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drop any file to check if it's already in the database. See who owns it and how many
            devices have it.
          </p>
        </header>

        <AnimatePresence mode="wait">
          {/* ── IDLE: Drop Zone ── */}
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
                    Accepts any file type. Checked directly against the Sentinel database — instant results.
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

          {/* ── SEARCHING ── */}
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
                {state === "hashing" ? "Computing fingerprint…" : "Searching database…"}
              </p>
              <p className="mt-1 text-xs font-mono text-muted-foreground truncate max-w-xs">{file?.name}</p>
              <div className="mt-4 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── RESULT ── */}
          {(state === "found" || state === "not_found") && searchResult !== null && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* Status header */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className={`px-5 py-4 border-b border-border flex items-center gap-3 ${state === "found" ? "bg-crimson/10" : "bg-emerald/10"}`}>
                  <div className={`grid h-10 w-10 place-items-center rounded-xl shrink-0 ${state === "found" ? "bg-crimson/20 text-crimson" : "bg-emerald/20 text-emerald"}`}>
                    {state === "found" ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                  </div>
                  <div className="flex-1">
                    <div className={`text-base font-bold ${state === "found" ? "text-crimson" : "text-emerald"}`}>
                      {state === "found" ? "Asset Found in Database" : "Asset Not Found"}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {state === "found"
                        ? `Registered by ${maskEmail(searchResult.ownerEmail)} · uploaded ${searchResult.uploadCount} time${searchResult.uploadCount !== 1 ? "s" : ""}`
                        : "This file has not been registered yet."}
                    </div>
                  </div>
                  <button
                    onClick={reset}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border transition-colors"
                  >
                    <RotateCcw size={11} /> New Search
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-0">
                  {/* Left: file + fingerprint */}
                  <div className="p-5 border-b sm:border-b-0 sm:border-r border-border space-y-4">
                    {previewUrl && (
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black/40">
                        <img src={previewUrl} alt={file?.name} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {["top-2 left-2 border-l-2 border-t-2", "top-2 right-2 border-r-2 border-t-2", "bottom-2 left-2 border-l-2 border-b-2", "bottom-2 right-2 border-r-2 border-b-2"].map((c) => (
                          <div key={c} className={`absolute h-4 w-4 border-primary/70 ${c}`} />
                        ))}
                      </div>
                    )}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">File</div>
                      <div className="text-sm font-medium truncate">{file?.name}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1"><Hash size={10} /> Fingerprint ({hashMethod === "phash" ? "pHash" : "SHA-256"})</span>
                        <button onClick={copyHash} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                          <Copy size={10} />
                          {copiedHash ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <div className="font-mono text-[11px] text-primary/90 break-all leading-relaxed bg-black/30 rounded-lg px-3 py-2">
                        {hash?.match(/.{1,8}/g)?.join(" ")}
                      </div>
                    </div>
                  </div>

                  {/* Right: match details */}
                  <div className="p-5 space-y-4">
                    {state === "found" ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <InfoTile icon={Users} label="Total Uploads" value={String(searchResult.uploadCount)} accent={searchResult.uploadCount > 1 ? "crimson" : "emerald"} />
                          <InfoTile icon={MapPin} label="Detections" value={String(searchResult.deviceCount || searchResult.uploadCount)} accent={searchResult.deviceCount > 0 ? "crimson" : "primary"} />
                        </div>

                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
                            <Lock size={10} /> Registered Owner
                          </div>
                          <div className="text-sm font-mono bg-black/30 rounded-lg px-3 py-2 flex items-center justify-between">
                            <span>{maskEmail(searchResult.ownerEmail)}</span>
                            {isCurrentUserOwner && (
                              <span className="text-[10px] bg-emerald/20 text-emerald px-1.5 py-0.5 rounded font-sans">You</span>
                            )}
                          </div>
                        </div>

                        {isCurrentUserOwner ? (
                          <div className="space-y-3">
                            <div className="flex items-start gap-2 rounded-xl bg-emerald/10 border border-emerald/20 px-3 py-2.5 text-xs text-emerald">
                              <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                              <span>You are the registered owner of this asset.</span>
                            </div>
                            <div className="rounded-xl border border-border bg-black/20 p-3.5 space-y-2.5">
                              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Transfer Ownership
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="email"
                                  value={transferEmail}
                                  onChange={(e) => setTransferEmail(e.target.value)}
                                  placeholder="recipient@example.com"
                                  className="flex-1 rounded-lg bg-black/40 border border-border px-3 py-1.5 text-xs outline-none focus:border-primary/60 placeholder:text-muted-foreground/50"
                                />
                                <button
                                  onClick={handleTransfer}
                                  disabled={isTransferring || !transferEmail.trim()}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-primary to-cyber text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                  {isTransferring ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    "Transfer"
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2 rounded-xl bg-crimson/10 border border-crimson/20 px-3 py-2.5 text-xs text-crimson">
                            <XCircle size={14} className="shrink-0 mt-0.5" />
                            <span>This asset is already registered. You are not the owner.</span>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-start gap-2 rounded-xl bg-emerald/10 border border-emerald/20 px-3 py-2.5 text-xs text-emerald">
                          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
                          <span>No match found. Register it now to become the owner.</span>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Algorithm</div>
                          <div className="text-sm font-mono text-muted-foreground">
                            {hashMethod === "phash" ? "Perceptual Hash (pHash-64)" : "SHA-256 (exact match)"}
                          </div>
                        </div>
                        <button
                          onClick={handleRegister}
                          disabled={registering}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary to-cyber text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {registering ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                          {registering ? "Registering…" : "Register & Become Owner"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Map — shown when locations exist */}
                {state === "found" && searchResult.locations.length > 0 && (
                  <div className="border-t border-border">
                    <div className="px-5 py-3 flex items-center gap-2">
                      <MapPin size={13} className="text-crimson" />
                      <span className="text-xs font-semibold">
                        Detection Map — {searchResult.locations.length} location{searchResult.locations.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="px-4 pb-4">
                      <WorldMap pins={searchResult.locations} compact />
                    </div>

                    {/* Location list */}
                    <div className="border-t border-border divide-y divide-border max-h-56 overflow-auto">
                      {searchResult.locations.map((loc, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02]">
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-crimson/15 text-crimson shrink-0">
                            <MapPin size={13} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{loc.city || "Unknown location"}</div>
                            <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                              {loc.device} · {loc.app}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] font-mono bg-crimson/15 text-crimson px-1.5 py-0.5 rounded">
                            {loc.confidence}% match
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No locations but found — show upload count info */}
                {state === "found" && searchResult.locations.length === 0 && (
                  <div className="border-t border-border px-5 py-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin size={12} />
                    <span>No device locations recorded yet for this asset.</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}

function InfoTile({ icon: Icon, label, value, accent }: {
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
