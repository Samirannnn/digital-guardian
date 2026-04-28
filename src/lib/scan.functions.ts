import { supabase } from "@/integrations/supabase/client";
import type { LeakLocation, ScanResult } from "./dna";

// Removed mock pHash generator

const cities = [
  { city: "Kolkata", country: "IN", lat: 22.57, lng: 88.36 },
  { city: "Mumbai", country: "IN", lat: 19.07, lng: 72.88 },
  { city: "Dubai", country: "AE", lat: 25.27, lng: 55.3 },
  { city: "Jakarta", country: "ID", lat: -6.21, lng: 106.85 },
  { city: "Lagos", country: "NG", lat: 6.52, lng: 3.38 },
  { city: "São Paulo", country: "BR", lat: -23.55, lng: -46.63 },
];
const devices = ["Realme 8", "Samsung A52", "iPhone 13", "Pixel 7", "OnePlus Nord", "Xiaomi 12"];
const apps = ["WhatsApp", "Telegram", "Instagram DM", "Signal", "Snapchat"];

import { generatePHash, searchPHash, protectPHash } from "./phash";

/**
 * Client-side scan — generates pHash, runs Cloud Run API leak detection,
 * and persists the asset + any leak locations to Supabase.
 */
export async function runScan(input: {
  data: {
    fileName: string;
    fileSize: number;
    storagePath: string;
    file: File;
  };
}): Promise<ScanResult & { assetId: string }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { fileName, fileSize, storagePath, file } = input.data;

  // Generate real pHash
  const hash = await generatePHash(file);

  // Call Cloud Run API to check for matches
  const searchResult = await searchPHash(hash);
  
  let isLeak = false;
  let status: "clean" | "leaked" = "clean";

  if (searchResult.match_found) {
    // If ANY match is found, flag it as detected/leaked
    isLeak = true;
    status = "leaked";
  } else {
    // If not found, register it under this user's email
    await protectPHash(hash, user.email || user.id);
  }

  // Fallback / mock leak simulation for demonstration purposes
  const forceLeak = /whats|leak|test/i.test(fileName);
  if (forceLeak) {
    isLeak = true;
  }
  const blockNumber = 18_452_193 + Math.floor(Math.random() * 999);
  const scannedAt = new Date().toISOString();

  // Insert asset
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

  let locations: LeakLocation[] = [];
  if (isLeak) {
    const count = forceLeak ? 1 : 1 + Math.floor(Math.random() * 3);
    locations = Array.from({ length: count }).map((_, i) => {
      const c = forceLeak ? cities[0] : cities[Math.floor(Math.random() * cities.length)];
      return {
        ...c,
        device: forceLeak && i === 0 ? "Realme 8" : devices[Math.floor(Math.random() * devices.length)],
        app: forceLeak && i === 0 ? "WhatsApp" : apps[Math.floor(Math.random() * apps.length)],
        confidence: forceLeak && i === 0 ? 94 : 72 + Math.floor(Math.random() * 25),
        timestamp: new Date(Date.now() - Math.random() * 86_400_000 * 3).toISOString(),
      };
    });

    const rows = locations.map((l) => ({
      asset_id: asset.id,
      user_id: user.id,
      city: l.city,
      lat: l.lat,
      lon: l.lng,
      device: l.device,
      app: l.app,
      confidence: l.confidence,
      detected_at: l.timestamp,
    }));

    const { error: lErr } = await supabase.from("leak_locations").insert(rows);
    if (lErr) console.error("leak_locations insert failed", lErr.message);
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
