import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ScanResult, LeakLocation } from "./dna";
import { useAuth } from "./auth";

export type DbAsset = {
  id: string;
  name: string;
  storage_path: string;
  size: number;
  hash: string;
  status: "clean" | "leaked";
  block_number: number | null;
  scanned_at: string;
  created_at: string;
  app_email?: string | null;
};

export type AssetWithLocations = DbAsset & {
  locations: LeakLocation[];
  signedUrl: string | null;
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

  const ids = assets.map((a) => a.id);
  const { data: locs } = await supabase
    .from("leak_locations")
    .select("*")
    .in("asset_id", ids);

  // Sign URLs in parallel
  const signed = await Promise.all(
    assets.map(async (a) => {
      const { data } = await supabase.storage
        .from("assets")
        .createSignedUrl(a.storage_path, SIGNED_URL_TTL);
      return { id: a.id, url: data?.signedUrl ?? null };
    }),
  );
  const urlMap = new Map(signed.map((s) => [s.id, s.url]));

  return assets.map((a) => ({
    ...(a as DbAsset),
    signedUrl: urlMap.get(a.id) ?? null,
    locations: (locs ?? [])
      .filter((l) => l.asset_id === a.id)
      .map<LeakLocation>((l) => ({
        city: l.city,
        country: "",
        lat: l.lat,
        lng: l.lon,
        device: l.device,
        app: l.app,
        confidence: l.confidence,
        timestamp: l.detected_at,
      })),
  }));
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
 * used by ResultView/WorldMap.
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
 * Realtime subscription so the vault refreshes when new assets are inserted.
 */
export function useAssetsRealtime() {
  const qc = useQueryClient();
  const { user } = useAuth();
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
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);
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
  uploadCount: number;        // how many times this hash appears in the DB
  deviceCount: number;        // entries in leak_locations for this hash
  locations: LeakLocation[];  // for the map
};

/**
 * Search Supabase for an asset by hash.
 * Returns owner info, how many times it's been uploaded, and all device locations.
 */
export async function lookupHashInDB(hash: string): Promise<HashLookupResult> {
  // Find all assets with this hash (across all users)
  const { data: assets, error } = await supabase
    .from("assets")
    .select("id, name, user_id, app_email, created_at")
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
    };
  }

  // The first-ever upload is the owner
  const original = assets[0];
  const allIds = assets.map((a) => a.id);

  // Get all leak_locations for all assets with this hash
  const { data: locs } = await supabase
    .from("leak_locations")
    .select("*")
    .in("asset_id", allIds);

  const locations: LeakLocation[] = (locs ?? []).map((l) => ({
    city: l.city,
    country: "",
    lat: l.lat,
    lng: l.lon,
    device: l.device,
    app: l.app,
    confidence: l.confidence,
    timestamp: l.detected_at,
  }));

  return {
    found: true,
    ownerEmail: original.app_email ?? null,
    ownerUserId: original.user_id,
    assetId: original.id,
    assetName: original.name,
    uploadCount: assets.length,
    deviceCount: locs?.length ?? 0,
    locations,
  };
}

/**
 * Transfer ownership of an asset: update owner_email on the DB row.
 * Only the current owner (matched by user_id) can do this.
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
 * Returns the profile's user_id if found, or null if not found.
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
  // Check if a pending transfer already exists for this asset to avoid duplicates
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
  } | null;
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
        hash
      )
    `)
    .eq("recipient_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data as any) ?? [];
}

/**
 * Accepts a transfer request by calling the accept_transfer_request RPC function.
 */
export async function acceptTransfer(requestId: string): Promise<{ success: boolean; message?: string }> {
  const { data, error } = await supabase.rpc("accept_transfer_request", {
    request_id: requestId,
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
