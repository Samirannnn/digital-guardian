import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LeakLocation, ScanResult } from "./dna";

/**
 * Mock pHash generator (deterministic from name+size).
 * TODO: Connect to Polygon/Smart Contract here
 */
function generateHash(seed: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 64; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out += chars[(h >>> (i % 28)) & 0xf];
  }
  return out;
}

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

const Input = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().min(0).max(50_000_000),
  storagePath: z.string().min(1).max(1024),
});

/**
 * Server-side scan — generates pHash, queries the (mock) ledger, and persists
 * the asset + any leak locations to the database under the authenticated user.
 */
export const runScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Simulate the 3-second blockchain query
    await new Promise((r) => setTimeout(r, 3000));

    const hash = generateHash(data.fileName + data.fileSize);
    const forceLeak = /whats|leak|test/i.test(data.fileName);
    const isLeak = forceLeak || Math.random() > 0.45;
    const blockNumber = 18_452_193 + Math.floor(Math.random() * 999);
    const scannedAt = new Date().toISOString();

    // Insert asset
    const { data: asset, error: aErr } = await supabase
      .from("assets")
      .insert({
        user_id: userId,
        name: data.fileName,
        storage_path: data.storagePath,
        size: data.fileSize,
        hash,
        status: isLeak ? "leaked" : "clean",
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
        user_id: userId,
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

    const result: ScanResult & { assetId: string } = {
      assetId: asset.id,
      hash,
      status: isLeak ? "leaked" : "clean",
      scannedAt,
      blockNumber,
      locations,
    };
    return result;
  });
