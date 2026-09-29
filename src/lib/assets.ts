import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScanResult, LeakLocation } from "./dna";
import { useAuth } from "./auth";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { getEnforcement, enforceBlur as callCloudRunEnforce } from "./phash";
import { uploadProtectedPreview } from "./blur";

export type DbAsset = {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  size: number;
  hash: string;
  status: "clean" | "leaked";
  block_number: number | null;
  scanned_at: string;
  created_at: string;
  app_email?: string | null;
  enforce_blur?: boolean;
  blur_strength?: number;
  blurred_preview_path?: string | null;
  is_blurred?: boolean;
};

export type AssetWithLocations = DbAsset & {
  locations: LeakLocation[];
  signedUrl: string | null;
  isOwner: boolean;
  isBlurred: boolean;
  enforce_blur: boolean;
  blur_strength: number;
  blurred_preview_path: string | null;
};

export type AuditLogEntry = {
  id: string;
  asset_id: string;
  user_id: string;
  action: "BLUR_ENABLED" | "BLUR_DISABLED" | "BLUR_STRENGTH_CHANGED";
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  assetName?: string;
};

const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function fetchAssets(userId: string): Promise<AssetWithLocations[]> {
  const { data: assets, error } = await supabase
    .from("assets")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!assets || assets.length === 0) return [];

  // Fetch the current user to get their email & uid
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;
  const userEmail = user?.email;

  const ids = assets.map((a) => a.id);
  const { data: locs } = await supabase
    .from("leak_locations")
    .select("*")
    .in("asset_id", ids);

  // Sign URLs based on secure ownership logic
  const signed = await Promise.all(
    assets.map(async (a: any) => {
      const isOwner = currentUserId === a.user_id;
      const isEnforced = a.enforce_blur ?? a.is_blurred ?? false;

      let targetPath = a.storage_path;

      // SECURITY: If requester is NOT owner AND asset is protected,
      // return ONLY the blurred preview signed URL. Never expose original path.
      if (!isOwner && isEnforced) {
        if (a.blurred_preview_path) {
          targetPath = a.blurred_preview_path;
        }
      }

      const { data } = await supabase.storage
        .from("assets")
        .createSignedUrl(targetPath, SIGNED_URL_TTL);

      return { id: a.id, url: data?.signedUrl ?? null };
    })
  );

  const urlMap = new Map(signed.map((s) => [s.id, s.url]));

  const resultAssets = await Promise.all(
    assets.map(async (a: any) => {
      const isDuplicate = a.status === "leaked" && a.app_email !== userEmail;
      
      let locsForAsset: any[] = [];
      
      if (isDuplicate) {
        // Query the oldest asset with this hash (the original owner's asset)
        const { data: origAssets } = await supabase
          .from("assets")
          .select("id")
          .eq("hash", a.hash)
          .order("created_at", { ascending: true })
          .limit(1);
          
        if (origAssets && origAssets.length > 0) {
          // Fetch the owner's initial register location
          const { data: origLocs } = await supabase
            .from("leak_locations")
            .select("*")
            .eq("asset_id", origAssets[0].id)
            .order("detected_at", { ascending: true })
            .limit(1);
            
          locsForAsset = origLocs ?? [];
        }
      } else {
        // Owner or clean asset — return all locations
        locsForAsset = (locs ?? []).filter((l) => l.asset_id === a.id);
      }

      const isOwner = currentUserId === a.user_id;
      let isBlurred = a.enforce_blur ?? a.is_blurred ?? false;

      if (!isBlurred) {
        try {
          const enf = await getEnforcement(a.hash);
          if (enf.isEnforced) isBlurred = true;
        } catch (e) {
          console.warn("Could not fetch enforcement:", e);
        }
      }

      return {
        ...(a as DbAsset),
        enforce_blur: isBlurred,
        blur_strength: a.blur_strength ?? 20,
        blurred_preview_path: a.blurred_preview_path ?? null,
        signedUrl: urlMap.get(a.id) ?? null,
        isOwner,
        isBlurred,
        locations: locsForAsset.map<LeakLocation>((l) => {
          const parts = l.city.split(", ");
          return {
            city: parts[0],
            country: parts[1] || "",
            lat: l.lat,
            lng: l.lon,
            device: l.device,
            app: l.app,
            confidence: l.confidence,
            timestamp: l.detected_at,
          };
        }),
      };
    })
  );

  return resultAssets;
}

export function useAssets() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assets", user?.id],
    queryFn: () => fetchAssets(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });
}

export function useRefreshAssets() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => qc.invalidateQueries({ queryKey: ["assets", user?.id] });
}

/**
 * Convert a stored asset row + its locations into the legacy ScanResult shape
 */
export function toScanResult(a: AssetWithLocations): ScanResult {
  return {
    hash: a.hash,
    status: a.status,
    scannedAt: a.scanned_at,
    blockNumber: a.block_number ?? 0,
    locations: a.locations,
  };
}

/**
 * Realtime subscription so the vault refreshes when new assets are inserted/updated.
 */
export function useAssetsRealtime() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`assets-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "assets", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["assets", user.id] }),
      )
      .subscribe();

    const chLeak = supabase
      .channel(`leak-locs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "leak_locations", filter: `user_id=eq.${user.id}` },
        async (payload: any) => {
          const { data: asset } = await supabase
            .from("assets")
            .select("name, status")
            .eq("id", payload.new.asset_id)
            .single();

          if (asset && asset.status === "leaked") {
            const parts = payload.new.city.split(", ");
            const displayCity = parts[0];
            const displayCountry = parts[1] ? `, ${parts[1]}` : "";
            
            toast.error(`🚨 Leak Detected: "${asset.name}" has been sighted at ${displayCity}${displayCountry}!`, {
              duration: 8000,
              action: {
                label: "View Map",
                onClick: () => navigate({ to: "/map" }),
              },
            });
          }
          qc.invalidateQueries({ queryKey: ["assets", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(chLeak);
    };
  }, [user?.id, qc, navigate]);
}

// Upload a File to the user's folder in the assets bucket
export async function uploadAssetFile(userId: string, file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("assets").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

/**
 * Bulk-upload multiple files with a concurrency cap of 3.
 */
export async function bulkUploadAssets(
  userId: string,
  files: File[],
  onProgress: (fileName: string, result: string | Error) => void,
): Promise<void> {
  const CONCURRENCY = 3;
  let index = 0;

  async function worker() {
    while (index < files.length) {
      const file = files[index++];
      try {
        const path = await uploadAssetFile(userId, file);
        onProgress(file.name, path);
      } catch (err) {
        onProgress(file.name, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// ─── Hash-based lookup helpers ────────────────────────────────────────────────

export type HashLookupResult = {
  found: boolean;
  ownerEmail: string | null;
  ownerUserId: string | null;
  assetId: string | null;
  assetName: string | null;
  uploadCount: number;        // how many times this hash appears in DB
  deviceCount: number;        // entries in leak_locations for this hash
  locations: LeakLocation[];  // for the map
  isBlurred: boolean;         // if owner has activated blur enforcement
  blurStrength: number;
  blurredPreviewUrl: string | null;
};

/**
 * Search Supabase for an asset by hash.
 * Returns owner info, how many times it's been uploaded, device locations, and secure preview.
 */
export async function lookupHashInDB(hash: string): Promise<HashLookupResult> {
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, name, user_id, app_email, created_at, enforce_blur, blur_strength, blurred_preview_path")
    .eq("hash", hash)
    .order("created_at", { ascending: true }); // oldest first = original owner

  if (error) throw error;

  if (!assets || assets.length === 0) {
    return {
      found: false,
      ownerEmail: null,
      ownerUserId: null,
      assetId: null,
      assetName: null,
      uploadCount: 0,
      deviceCount: 0,
      locations: [],
      isBlurred: false,
      blurStrength: 20,
      blurredPreviewUrl: null,
    };
  }

  // The first-ever upload is the owner
  const original = assets[0];
  const allIds = assets.map((a) => a.id);

  // Get current user to check ownership
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  const { data: locs } = await supabase
    .from("leak_locations")
    .select("*")
    .in("asset_id", allIds);

  const locations: LeakLocation[] = (locs ?? []).map((l) => {
    const parts = l.city.split(", ");
    return {
      city: parts[0],
      country: parts[1] || "",
      lat: l.lat,
      lng: l.lon,
      device: l.device,
      app: l.app,
      confidence: l.confidence,
      timestamp: l.detected_at,
    };
  });

  let isBlurred = (original as any).enforce_blur ?? (original as any).is_blurred ?? false;
  if (!isBlurred) {
    try {
      const enf = await getEnforcement(hash);
      isBlurred = enf.isEnforced;
    } catch (e) {
      console.warn("Could not retrieve enforcement:", e);
    }
  }

  let blurredPreviewUrl: string | null = null;

  if (isBlurred && (original as any).blurred_preview_path) {
    const { data: signData } = await supabase.storage
      .from("assets")
      .createSignedUrl((original as any).blurred_preview_path, SIGNED_URL_TTL);
    blurredPreviewUrl = signData?.signedUrl ?? null;
  }

  return {
    found: true,
    ownerEmail: original.app_email ?? null,
    ownerUserId: original.user_id,
    assetId: original.id,
    assetName: original.name,
    uploadCount: assets.length,
    deviceCount: locs?.length ?? 0,
    locations,
    isBlurred,
    blurStrength: (original as any).blur_strength ?? 20,
    blurredPreviewUrl,
  };
}

/**
 * Update Asset Protection Settings (Blur Enable/Disable, Blur Strength)
 */
export async function updateAssetProtection(params: {
  assetId: string;
  userId: string;
  userEmail: string;
  hash: string;
  enforceBlur: boolean;
  blurStrength: number;
  imageSource?: File | string;
}): Promise<{ success: boolean; message?: string }> {
  const { assetId, userId, userEmail, hash, enforceBlur, blurStrength, imageSource } = params;

  // 1. Fetch existing asset row to check previous state
  const { data: existingAsset, error: fetchErr } = await supabase
    .from("assets")
    .select("*")
    .eq("id", assetId)
    .single();

  if (fetchErr || !existingAsset) {
    return { success: false, message: "Asset not found" };
  }

  const prevEnforce = (existingAsset as any).enforce_blur ?? (existingAsset as any).is_blurred ?? false;
  const prevStrength = (existingAsset as any).blur_strength ?? 20;

  let blurredPreviewPath = (existingAsset as any).blurred_preview_path;

  // 2. If protection is enabled or blur strength changed, generate/update protected preview
  if (enforceBlur && (imageSource || !blurredPreviewPath || prevStrength !== blurStrength)) {
    try {
      let sourceToProcess = imageSource;
      if (!sourceToProcess) {
        const { data: signData } = await supabase.storage
          .from("assets")
          .createSignedUrl(existingAsset.storage_path, 3600);
        if (signData?.signedUrl) {
          sourceToProcess = signData.signedUrl;
        }
      }

      if (sourceToProcess) {
        blurredPreviewPath = await uploadProtectedPreview(
          userId,
          assetId,
          sourceToProcess,
          blurStrength
        );
      }
    } catch (err) {
      console.warn("Failed to generate blurred preview blob:", err);
    }
  }

  // 3. Update database record (safe payload)
  const updatePayload: Record<string, any> = {
    enforce_blur: enforceBlur,
    blur_strength: blurStrength,
    blurred_preview_path: blurredPreviewPath,
  };

  const { error: updateErr } = await supabase
    .from("assets")
    .update(updatePayload)
    .eq("id", assetId)
    .eq("user_id", userId);

  if (updateErr) {
    return { success: false, message: updateErr.message };
  }

  // 4. Audit Log Entry
  let action: "BLUR_ENABLED" | "BLUR_DISABLED" | "BLUR_STRENGTH_CHANGED" = "BLUR_ENABLED";
  if (!prevEnforce && enforceBlur) action = "BLUR_ENABLED";
  else if (prevEnforce && !enforceBlur) action = "BLUR_DISABLED";
  else if (prevStrength !== blurStrength) action = "BLUR_STRENGTH_CHANGED";

  await supabase.from("protection_audit_logs").insert({
    asset_id: assetId,
    user_id: userId,
    action,
    old_value: `enforce=${prevEnforce},strength=${prevStrength}`,
    new_value: `enforce=${enforceBlur},strength=${blurStrength}`,
  });

  // 5. Cloud Run API call (non-fatal)
  try {
    await callCloudRunEnforce(hash, userEmail);
  } catch (err) {
    console.warn("Cloud Run enforce API call failed:", err);
  }

  return { success: true };
}

/**
 * Fetch Protection Audit Logs for the current user
 */
export async function fetchProtectionAuditLogs(userId: string): Promise<AuditLogEntry[]> {
  const { data: logs, error } = await supabase
    .from("protection_audit_logs")
    .select(`
      id,
      asset_id,
      user_id,
      action,
      old_value,
      new_value,
      created_at,
      assets (
        name
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("Could not fetch audit logs:", error);
    return [];
  }

  return (logs ?? []).map((l: any) => ({
    id: l.id,
    asset_id: l.asset_id,
    user_id: l.user_id,
    action: l.action,
    old_value: l.old_value,
    new_value: l.new_value,
    created_at: l.created_at,
    assetName: l.assets?.name ?? "Asset",
  }));
}

/**
 * Transfer ownership of an asset
 */
export async function transferOwnershipDB(
  hash: string,
  newOwnerEmail: string,
): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase
    .from("assets")
    .update({ app_email: newOwnerEmail })
    .eq("hash", hash);

  if (error) return { success: false, message: error.message };
  return { success: true };
}

// Delete an asset from database and storage
export async function deleteAsset(id: string, storagePath: string) {
  if (storagePath) {
    const { error: storageError } = await supabase.storage.from("assets").remove([storagePath]);
    if (storageError) console.error("Failed to delete storage file:", storageError);
  }
  await supabase.from("leak_locations").delete().eq("asset_id", id);
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Check if a user account exists with this email address.
 */
export async function checkEmailExists(email: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Error checking email existence:", error);
    return null;
  }
  return data?.user_id ?? null;
}

/**
 * Creates a pending transfer request in the database.
 */
export async function createTransferRequest(
  assetId: string,
  senderId: string,
  recipientId: string,
  recipientEmail: string,
): Promise<{ success: boolean; message?: string }> {
  const { data: existing } = await supabase
    .from("transfer_requests")
    .select("id")
    .eq("asset_id", assetId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return { success: false, message: "A pending transfer request already exists for this asset." };
  }

  const { error } = await supabase.from("transfer_requests").insert({
    asset_id: assetId,
    sender_id: senderId,
    recipient_id: recipientId,
    recipient_email: recipientEmail,
    status: "pending",
  });

  if (error) return { success: false, message: error.message };
  return { success: true };
}

/**
 * Fetches all incoming pending transfer requests for the current user.
 */
export type TransferRequestWithAsset = {
  id: string;
  asset_id: string;
  sender_id: string;
  recipient_id: string;
  recipient_email: string;
  status: string;
  created_at: string;
  assets: {
    name: string;
    hash: string;
    storage_path: string;
  } | null;
  signedUrl?: string | null;
};

export async function fetchPendingTransfers(userId: string): Promise<TransferRequestWithAsset[]> {
  const { data, error } = await supabase
    .from("transfer_requests")
    .select(`
      id,
      asset_id,
      sender_id,
      recipient_id,
      recipient_email,
      status,
      created_at,
      assets (
        name,
        hash,
        storage_path
      )
    `)
    .eq("recipient_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data) return [];

  const signed = await Promise.all(
    data.map(async (req: any) => {
      let signedUrl = null;
      if (req.assets?.storage_path) {
        const { data: signData } = await supabase.storage
          .from("assets")
          .createSignedUrl(req.assets.storage_path, 3600);
        signedUrl = signData?.signedUrl ?? null;
      }
      return {
        ...req,
        signedUrl,
      };
    })
  );

  return signed as any;
}

/**
 * Accepts a transfer request
 */
export async function acceptTransfer(
  requestId: string,
  lat: number,
  lng: number,
  city: string
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc("accept_transfer_request", {
    request_id: requestId,
    new_lat: lat,
    new_lon: lng,
    new_city: city,
  });

  if (error) return { success: false, message: error.message };
  return { success: data as boolean };
}

/**
 * Rejects a transfer request.
 */
export async function rejectTransfer(requestId: string): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase
    .from("transfer_requests")
    .update({ status: "rejected" })
    .eq("id", requestId);

  if (error) return { success: false, message: error.message };
  return { success: true };
}

/**
 * Remotely wipes / removes a leaked asset copy
 */
export async function wipeRemoteAsset(
  ownerUserId: string,
  assetHash: string,
  lat: number,
  lng: number
): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc("wipe_remote_asset", {
    owner_uid: ownerUserId,
    asset_hash: assetHash,
    target_lat: lat,
    target_lon: lng,
  });

  if (error) {
    console.error("Wipe remote asset RPC error:", error);
    return { success: false, message: error.message };
  }

  if (data === false) {
    return { success: false, message: "Authorized owner verification failed. Only the original owner can delete duplicate asset copies." };
  }

  return { success: true };
}
