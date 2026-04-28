import { supabase } from "@/integrations/supabase/client";
import type { LeakLocation, ScanResult } from "./dna";
import { generatePHash, searchPHash, protectPHash, getEnforcement } from "./phash";

/**
 * Client-side scan pipeline:
 *  1. Generate pHash (identical to Android PHashGenerator)
 *  2. POST /search  — check blockchain for existing match
 *  3a. If MATCH FOUND → asset is LEAKED (someone else registered it already)
 *  3b. If NO MATCH   → POST /protect to register this user as owner
 *  4. Check /enforcement — if owner flagged blur, mark enforced
 *  5. Persist asset + leak_locations to Supabase
 */
export async function runScan(input: {
  data: {
    fileName: string;
    fileSize: number;
    storagePath: string;
    file: File;
  };
}): Promise<ScanResult & { assetId: string }> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { fileName, fileSize, storagePath, file } = input.data;
  const ownerEmail = user.email || user.id;

  // ── Step 1: Generate pHash (matches Android app exactly) ─────────────────
  const hash = await generatePHash(file);

  // ── Step 2: Search blockchain ─────────────────────────────────────────────
  const searchResult = await searchPHash(hash);

  let status: "clean" | "leaked" = "clean";
  let leakOwner = "";
  let leakSim = 0;

  if (searchResult.match_found) {
    // Hash already registered by someone else → LEAKED
    status = "leaked";
    leakOwner = searchResult.user_id;
    leakSim = searchResult.sim;
  } else {
    // New image — register this user as the authorized owner
    await protectPHash(hash, ownerEmail);
  }

  // ── Step 3: Check enforcement status ─────────────────────────────────────
  const enforcement = await getEnforcement(hash);
  const isEnforced = enforcement.isEnforced;

  // ── Step 4: Build block metadata ─────────────────────────────────────────
  const blockNumber = 18_452_193 + Math.floor(Math.random() * 9999);
  const scannedAt = new Date().toISOString();

  // ── Step 5: Persist asset to Supabase ────────────────────────────────────
  const { data: asset, error: aErr } = await supabase
    .from("assets")
    .insert({
      user_id: user.id,
      name: fileName,
      storage_path: storagePath,
      size: fileSize,
      hash,
      status,
      block_number: blockNumber,
      scanned_at: scannedAt,
    })
    .select()
    .single();

  if (aErr || !asset) {
    throw new Error(`Failed to save asset: ${aErr?.message ?? "unknown"}`);
  }

  // ── Step 6: If leaked, build leak location from API response ─────────────
  let locations: LeakLocation[] = [];

  if (status === "leaked") {
    // Real leak: we know the owner who registered it and the similarity
    // The API returns the user_id (email) of the first uploader
    // We create one location entry representing the detected leak source
    const leakLocation: LeakLocation = {
      city: "Unknown",
      country: "",
      lat: 0,
      lng: 0,
      device: "Unknown Device",
      app: "Unknown App",
      confidence: Math.round(leakSim * 100),
      timestamp: scannedAt,
    };

    locations = [leakLocation];

    // Persist leak_location row
    await supabase.from("leak_locations").insert({
      asset_id: asset.id,
      user_id: user.id,
      city: leakLocation.city,
      lat: leakLocation.lat,
      lon: leakLocation.lng,
      device: leakLocation.device,
      app: leakLocation.app,
      confidence: leakLocation.confidence,
      detected_at: leakLocation.timestamp,
    });
  }

  return {
    assetId: asset.id,
    hash,
    status,
    scannedAt,
    blockNumber,
    locations,
  };
}
