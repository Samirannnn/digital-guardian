import { useEffect, useState } from "react";
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

// Tiny helper to upload a File to the user's folder in the assets bucket
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

// Re-export for legacy imports
export { useState };
