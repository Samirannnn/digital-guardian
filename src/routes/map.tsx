import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { WorldMap } from "@/components/dashboard/WorldMap";
import { Globe2, Radio } from "lucide-react";
import type { LeakLocation } from "@/lib/dna";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Global Tracking — Sentinel" },
      { name: "description", content: "World-wide leak distribution map for your protected media." },
      { property: "og:title", content: "Global Tracking — Sentinel" },
      { property: "og:description", content: "Visualize where your assets are circulating across the Android network." },
    ],
  }),
  component: MapPage,
});

const pins: LeakLocation[] = [
  { city: "Kolkata", country: "IN", lat: 22.57, lng: 88.36, device: "Realme 8", app: "WhatsApp", confidence: 94, timestamp: "" },
  { city: "Mumbai", country: "IN", lat: 19.07, lng: 72.88, device: "Samsung A52", app: "Telegram", confidence: 88, timestamp: "" },
  { city: "Dubai", country: "AE", lat: 25.27, lng: 55.3, device: "iPhone 12", app: "Instagram", confidence: 76, timestamp: "" },
  { city: "Lagos", country: "NG", lat: 6.52, lng: 3.38, device: "Tecno Spark", app: "WhatsApp", confidence: 81, timestamp: "" },
  { city: "São Paulo", country: "BR", lat: -23.55, lng: -46.63, device: "Xiaomi Redmi", app: "WhatsApp", confidence: 91, timestamp: "" },
  { city: "Manila", country: "PH", lat: 14.6, lng: 120.98, device: "Oppo A15", app: "Snapchat", confidence: 72, timestamp: "" },
  { city: "Cairo", country: "EG", lat: 30.04, lng: 31.24, device: "Infinix Hot", app: "Telegram", confidence: 79, timestamp: "" },
];

function MapPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <Globe2 size={12} /> Global Tracking
          </div>
          <h1 className="mt-1 text-2xl lg:text-3xl font-bold tracking-tight">
            Worldwide <span className="text-gradient-primary">Distribution Map</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time pin drops where your signatures have been re-encountered.
          </p>
        </header>

        <div className="glass rounded-2xl p-3">
          <WorldMap pins={pins} />
        </div>

        <div className="glass rounded-2xl">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Radio size={14} className="text-primary" />
            <span className="text-sm font-semibold">Detection Hotspots</span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {pins.length} active regions
            </span>
          </div>
          <div className="divide-y divide-border">
            {pins.map((p, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03]">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary text-[10px] font-mono">
                  {p.country}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.city}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {p.device} · {p.app}
                  </div>
                </div>
                <div className="text-sm font-mono text-crimson">{p.confidence}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
