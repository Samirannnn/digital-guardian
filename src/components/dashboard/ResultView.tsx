import { useState } from "react";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Smartphone,
  MessageCircle,
  Hash,
  X,
  Trash2,
  Mail,
  CheckCircle2,
  EyeOff,
  Lock,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import type { ScanResult } from "@/lib/dna";
import { WorldMap } from "./WorldMap";
import { toast } from "sonner";
import { ProtectionConfirmModal } from "./ProtectionConfirmModal";
import { BLUR_PRESETS } from "@/lib/blur";
import { updateAssetProtection } from "@/lib/assets";
import { useAuth } from "@/lib/auth";

function maskEmail(email: string | null): string {
  if (!email) return "Unknown";
  if (email.includes("@")) {
    const [name, domain] = email.split("@");
    return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
  }
  return `${email.slice(0, 4)}****${email.slice(-4)}`;
}

type Props = {
  imageUrl: string;
  result: ScanResult;
  ownerEmail?: string | null;
  fileName?: string;
  assetId?: string;
  blurStrength?: number;
  onClose: () => void;
  isOwner?: boolean;
  onWipe?: (lat: number, lng: number) => Promise<void>;
  onRefresh?: () => void;
};

function getFileType(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "ogg", "mov"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  return "other";
}

export function ResultView({
  imageUrl,
  result,
  ownerEmail,
  fileName,
  assetId,
  blurStrength = 20,
  onClose,
  isOwner,
  onWipe,
  onRefresh,
}: Props) {
  const { user } = useAuth();
  const leaked = result.status === "leaked";
  const fileType = fileName ? getFileType(fileName) : "image";
  const [requestSent, setRequestSent] = useState(false);

  // Protection state
  const [enforceBlur, setEnforceBlur] = useState<boolean>(result.isBlurred ?? false);
  const [selectedStrength, setSelectedStrength] = useState<number>(blurStrength);
  const [pendingBlurState, setPendingBlurState] = useState<boolean | null>(null);
  const [isSavingProtection, setIsSavingProtection] = useState(false);

  const handleContactRequest = () => {
    setRequestSent(true);
    toast.success("📩 Contact request sent! The owner will be notified.");
  };

  const handleToggleClick = (targetState: boolean) => {
    setPendingBlurState(targetState);
  };

  const handleConfirmProtectionChange = async () => {
    if (pendingBlurState === null || !assetId || !user?.id || !user?.email) return;
    const nextState = pendingBlurState;
    setPendingBlurState(null);
    setIsSavingProtection(true);

    try {
      const res = await updateAssetProtection({
        assetId,
        userId: user.id,
        userEmail: user.email,
        hash: result.hash,
        enforceBlur: nextState,
        blurStrength: selectedStrength,
        imageSource: imageUrl,
      });

      if (res.success) {
        setEnforceBlur(nextState);
        toast.success(
          nextState
            ? "🔒 Asset protection enabled! Other users will only see a blurred preview."
            : "🔓 Asset protection disabled."
        );
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.message || "Failed to update protection settings.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while updating protection settings.");
    } finally {
      setIsSavingProtection(false);
    }
  };

  const handleSaveStrength = async () => {
    if (!assetId || !user?.id || !user?.email) return;
    setIsSavingProtection(true);
    try {
      const res = await updateAssetProtection({
        assetId,
        userId: user.id,
        userEmail: user.email,
        hash: result.hash,
        enforceBlur,
        blurStrength: selectedStrength,
        imageSource: imageUrl,
      });

      if (res.success) {
        toast.success(`✓ Blur strength updated to ${selectedStrength}px.`);
        if (onRefresh) onRefresh();
      } else {
        toast.error(res.message || "Failed to update blur strength.");
      }
    } catch {
      toast.error("Failed to update blur strength.");
    } finally {
      setIsSavingProtection(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid gap-4 lg:grid-cols-2"
    >
      {/* LEFT — image + signature */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Hash size={14} className="text-primary" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground truncate max-w-xs">
                {fileName || "Signature Generated"}
              </span>
            </div>
            <button
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-md hover:bg-white/5 text-muted-foreground cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          <div className="relative aspect-[4/3] bg-black/40">
            {fileType === "image" && (
              <img
                src={imageUrl}
                alt={fileName || "Asset"}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-300 ${
                  !isOwner && result.isBlurred ? "filter blur-xl brightness-50" : ""
                }`}
              />
            )}
            {fileType === "video" && (
              <video
                src={imageUrl}
                controls={isOwner || !result.isBlurred}
                className={`absolute inset-0 h-full w-full object-contain bg-black transition-all duration-300 ${
                  !isOwner && result.isBlurred ? "filter blur-2xl brightness-50" : ""
                }`}
              />
            )}
            {fileType === "audio" && (
              <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
                {isOwner || !result.isBlurred ? (
                  <audio src={imageUrl} controls className="w-full" />
                ) : (
                  <div className="text-center space-y-1">
                    <Lock className="h-6 w-6 text-crimson mx-auto" />
                    <span className="text-xs text-muted-foreground font-mono">Audio Playback Restricted</span>
                  </div>
                )}
              </div>
            )}
            {fileType === "pdf" && (
              <iframe
                src={imageUrl}
                className={`absolute inset-0 h-full w-full border-none bg-white transition-all duration-300 ${
                  !isOwner && result.isBlurred ? "filter blur-2xl opacity-40 pointer-events-none" : ""
                }`}
              />
            )}
            {fileType === "other" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 p-4 text-center">
                <span className="text-xs font-semibold mb-2">
                  {!isOwner && result.isBlurred ? "🔒 Protected Asset — Preview Restricted" : "No preview available for this file type"}
                </span>
                {(isOwner || !result.isBlurred) && (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 transition-opacity"
                  >
                    Download / View File
                  </a>
                )}
              </div>
            )}

            {/* Non-owner restricted overlay */}
            {!isOwner && result.isBlurred && (
              <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10 space-y-2">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-crimson/20 border border-crimson/30 text-crimson animate-pulse">
                  <Lock size={22} />
                </div>
                <span className="text-sm font-bold text-white uppercase tracking-wider">🔒 Protected Asset</span>
                <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                  This asset has been protected by its owner. Non-owners are restricted from viewing or downloading the original file.
                </p>
              </div>
            )}

            {/* hex overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 p-4 font-mono text-[10px] leading-relaxed text-primary/90 pointer-events-none">
              <div className="text-[9px] uppercase tracking-[0.2em] text-primary/70 mb-1.5">
                pHash · 256 bit
              </div>
              <div className="break-all">
                {result.hash.match(/.{1,4}/g)?.join(" ")}
              </div>
            </div>
            {/* scanning grid corners */}
            {["top-3 left-3 border-l-2 border-t-2", "top-3 right-3 border-r-2 border-t-2", "bottom-3 left-3 border-l-2 border-b-2", "bottom-3 right-3 border-r-2 border-b-2"].map((c) => (
              <div key={c} className={`absolute h-5 w-5 border-primary ${c} pointer-events-none`} />
            ))}
          </div>
        </div>

        <div>
          <div className="px-4 py-2.5 border-t border-border bg-black/20 flex items-center justify-between text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Registered Owner</span>
              <span className="font-mono text-primary font-medium mt-0.5">{ownerEmail || "Unknown"}</span>
            </div>
            {isOwner || !result.isBlurred ? (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-md border border-border hover:bg-white/5 transition-colors text-[10px] font-semibold"
              >
                Download Original
              </a>
            ) : (
              <span className="px-2.5 py-1 rounded-md border border-crimson/30 bg-crimson/10 text-crimson text-[10px] font-semibold flex items-center gap-1">
                <Lock size={10} /> Original download restricted
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-px bg-border border-t border-border">
            <Stat label="Block #" value={`#${result.blockNumber.toLocaleString()}`} />
            <Stat label="Algorithm" value="pHash-256" />
            <Stat label="Network" value="Polygon" />
          </div>
        </div>
      </div>

      {/* RIGHT — Owner Protection Controls or Distribution Report */}
      <div className="glass rounded-2xl overflow-hidden flex flex-col justify-between">
        <div>
          <div
            className={`px-4 py-3 border-b border-border flex items-center justify-between ${
              leaked ? (isOwner ? "bg-crimson/10" : "bg-orange-500/10") : "bg-emerald/10"
            }`}
          >
            <div className="flex items-center gap-2">
              {leaked ? (
                isOwner ? (
                  <ShieldAlert size={16} className="text-crimson" />
                ) : (
                  <ShieldAlert size={16} className="text-orange-400" />
                )
              ) : (
                <ShieldCheck size={16} className="text-emerald" />
              )}
              <span className={`text-sm font-semibold ${leaked ? (isOwner ? "text-crimson" : "text-orange-400") : "text-emerald"}`}>
                {leaked ? (isOwner ? "Leak Detected" : "Registered Asset Found") : "Asset is Clean"}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {isOwner ? "Owner Control & Distribution" : "Protection Report"}
            </span>
          </div>

          {/* ── OWNER ASSET PROTECTION CONTROL PANEL ── */}
          {isOwner && assetId && (
            <div className="p-4 border-b border-border bg-black/30 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                  <Lock size={13} className="text-primary" /> Asset Protection
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border ${
                    enforceBlur
                      ? "bg-crimson/20 text-crimson border-crimson/40"
                      : "bg-white/5 text-muted-foreground border-border"
                  }`}
                >
                  {enforceBlur ? "Protection: ON 🔒" : "Protection: OFF"}
                </span>
              </div>

              {/* Toggle controls */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-border">
                <div>
                  <div className="text-xs font-semibold text-white">Blur for other users</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Hide original asset from non-owners with a blurred preview.
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-border shrink-0">
                  <button
                    onClick={() => handleToggleClick(false)}
                    disabled={isSavingProtection}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      !enforceBlur
                        ? "bg-white/10 text-white border border-border"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    OFF
                  </button>
                  <button
                    onClick={() => handleToggleClick(true)}
                    disabled={isSavingProtection}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      enforceBlur
                        ? "bg-crimson text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]"
                        : "text-muted-foreground hover:text-white"
                    }`}
                  >
                    ON 🔒
                  </button>
                </div>
              </div>

              {/* Blur Strength Selection */}
              {enforceBlur && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2 pt-1"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                      <SlidersHorizontal size={11} /> Blur Strength
                    </span>
                    <span className="font-mono text-[10px] text-primary">{selectedStrength}px</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5">
                    {BLUR_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setSelectedStrength(preset.value)}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-medium border text-center transition-all cursor-pointer ${
                          selectedStrength === preset.value
                            ? "bg-primary/20 border-primary text-primary font-bold shadow-sm"
                            : "bg-black/20 border-border/80 text-muted-foreground hover:text-white"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveStrength}
                    disabled={isSavingProtection || selectedStrength === blurStrength}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-primary/10 border border-border hover:border-primary/40 text-white disabled:opacity-40 transition-all cursor-pointer"
                  >
                    {isSavingProtection && <Loader2 size={11} className="animate-spin" />}
                    Save Protection Settings
                  </button>
                </motion.div>
              )}
            </div>
          )}

          {/* Sighting reports / Distribution details */}
          {leaked ? (
            !isOwner ? (
              <div className="p-6 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs text-orange-400 flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5 text-orange-400" />
                    <div>
                      <strong className="text-white block mb-0.5 font-bold text-sm">Asset Already Registered</strong>
                      This digital asset is registered to another owner.
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Registered Owner</span>
                      <div className="text-sm font-medium text-white font-mono mt-1 bg-white/5 border border-border rounded-lg px-3 py-2">
                        {ownerEmail ? maskEmail(ownerEmail) : "Protected User"}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">Ownership Verification Status</span>
                      <div className="mt-1 flex items-center gap-2 text-emerald bg-emerald/10 border border-emerald/20 px-3 py-2 rounded-lg text-xs font-semibold">
                        <CheckCircle2 size={14} className="shrink-0" />
                        <span>Verified Owner on Polygon Blockchain</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={handleContactRequest}
                    disabled={requestSent}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      requestSent
                        ? "bg-white/5 text-muted-foreground border border-border cursor-not-allowed"
                        : "bg-gradient-to-r from-primary to-cyber text-primary-foreground hover:opacity-90 hover:scale-[1.01] active:scale-95 cursor-pointer"
                    }`}
                  >
                    <Mail size={14} />
                    {requestSent ? "Contact Request Sent" : "Request Contact with Owner"}
                  </button>
                </div>
              </div>
            ) : (
              /* Original Owner's Sighting Map View */
              <>
                <div className="p-2 border-b border-border">
                  <WorldMap pins={result.locations} compact />
                </div>
                <div className="flex-1 max-h-60 overflow-auto divide-y divide-border">
                  {result.locations.map((loc, i) => (
                    <div key={i} className="p-3 flex items-center gap-3 hover:bg-white/[0.03]">
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-crimson/15 text-crimson shrink-0">
                        <MapPin size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white">{loc.city}, {loc.country}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-crimson/15 text-crimson">
                            {loc.confidence}% match
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                          <span><Smartphone size={9} className="inline mr-0.5" />{loc.device}</span>
                          <span><MessageCircle size={9} className="inline mr-0.5" />{loc.app}</span>
                        </div>
                      </div>
                      {isOwner && onWipe && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm(`Remove asset copy at [${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)}]?`)) {
                              await onWipe(loc.lat, loc.lng);
                            }
                          }}
                          className="px-2 py-1 rounded text-[10px] font-semibold bg-crimson/15 text-crimson border border-crimson/30 hover:bg-crimson hover:text-white transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )
          ) : (
            <div className="p-8 text-center space-y-2">
              <div className="relative mx-auto h-12 w-12">
                <div className="absolute inset-0 rounded-full bg-emerald/20 blur-lg" />
                <div className="relative grid h-12 w-12 place-items-center rounded-full bg-emerald/15 border border-emerald/30">
                  <ShieldCheck className="h-6 w-6 text-emerald" />
                </div>
              </div>
              <h4 className="text-sm font-bold text-white">No unauthorized leaks found</h4>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Asset signatures are verified on the Polygon network ledger.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ProtectionConfirmModal
        open={pendingBlurState !== null}
        action={pendingBlurState ? "enable" : "disable"}
        assetName={fileName || "Selected Asset"}
        loading={isSavingProtection}
        onConfirm={handleConfirmProtectionChange}
        onCancel={() => setPendingBlurState(null)}
      />
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
