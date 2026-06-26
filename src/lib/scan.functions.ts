import { supabase } from "@/integrations/supabase/client";
import type { LeakLocation, ScanResult } from "./dna";
import { getFileHash } from "./phash";
import { lookupHashInDB } from "./assets";

/**
 * Client-side scan pipeline (Supabase-first, blockchain optional):
 *  1. Generate hash (pHash for images, SHA-256 for everything else)
 *  2. Query Supabase — does this hash already exist?
 *     a. EXISTS   → asset was already uploaded by someone → mark leaked, record location
 *     b. NOT EXISTS → new asset → save as owner (status = clean)
 *  3. Persist to Supabase
 */
export async function runScan(input: {
  data: {
    fileName: string;
    fileSize: number;
    storagePath: string;
    file: File;
  };
  location?: {
    lat: number;
    lng: number;
    city: string;
    country: string;
  };
}): Promise<ScanResult & { assetId: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { fileName, fileSize, storagePath, file } = input.data;
  const ownerEmail = user.email ?? user.id;

  // ── Step 1: Generate hash ─────────────────────────────────────────────────
  const { hash } = await getFileHash(file);

  // ── Step 2: Check Supabase for existing hash ──────────────────────────────
  const existing = await lookupHashInDB(hash);

  let status: "clean" | "leaked" = "clean";
  let leakLocations: LeakLocation[] = [];
  const blockNumber = 18_452_193 + Math.floor(Math.random() * 9999);
  const scannedAt = new Date().toISOString();

  // ── Step 3: Save asset to Supabase ────────────────────────────────────────
  const { data: asset, error: aErr } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: fileName,
      storage_path: storagePath,
      size: fileSize,
      hash,
      status: existing.found ? "leaked" : "clean",
      block_number: blockNumber,
      scanned_at: scannedAt,
      app_email: existing.found ? existing.ownerEmail : ownerEmail,
    })
    .select()
    .single();

  if (aErr || !asset) {
    throw new Error(`Failed to save asset: ${aErr?.message ?? "unknown"}`);
  }

  if (existing.found) {
    // ── Asset already exists — this is a duplicate upload ──────────────────
    status = "leaked";

    const customCity = input.location
      ? `${input.location.city}, ${input.location.country}`
      : undefined;

    // Build a location entry for this new detection
    const leakLocation: LeakLocation = {
      city: input.location?.city ?? "Unknown",
      country: input.location?.country ?? "",
      lat: input.location?.lat ?? 0,
      lng: input.location?.lng ?? 0,
      device: "Web Upload",
      app: "Sentinel Web",
      confidence: 100,
      timestamp: scannedAt,
    };

    leakLocations = [leakLocation, ...existing.locations];

    // Persist this detection as a leak_location for the current scan
    await supabase.from("leak_locations").insert({
      asset_id: asset.id,
      user_id: user.id,
      city: customCity ?? (existing.locations[0]?.city 
        ? `${existing.locations[0].city}, ${existing.locations[0].country}` 
        : "Unknown"),
      lat: leakLocation.lat,
      lon: leakLocation.lng,
      device: leakLocation.device,
      app: leakLocation.app,
      confidence: leakLocation.confidence,
      detected_at: leakLocation.timestamp,
    });

    // Also record this leak detection on the original owner's asset so it updates their map
    if (existing.assetId && existing.ownerUserId) {
      await supabase.from("leak_locations").insert({
        asset_id: existing.assetId,
        user_id: existing.ownerUserId,
        city: customCity ?? (existing.locations[0]?.city 
          ? `${existing.locations[0].city}, ${existing.locations[0].country}` 
          : "Unknown"),
        lat: leakLocation.lat,
        lon: leakLocation.lng,
        device: leakLocation.device,
        app: leakLocation.app,
        confidence: leakLocation.confidence,
        detected_at: leakLocation.timestamp,
      });
    }
  }

  return {
    assetId: asset.id,
    hash,
    status,
    scannedAt,
    blockNumber,
    locations: leakLocations,
  };
}
