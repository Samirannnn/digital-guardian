import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LeakLocation } from "@/lib/dna";

type Props = {
  pins: LeakLocation[];
  compact?: boolean;
};

// Custom glowing red dot marker
const leakIcon = L.divIcon({
  className: "custom-leak-marker",
  html: `<div class="relative flex h-6 w-6 items-center justify-center">
           <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-crimson opacity-60"></span>
           <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-crimson shadow-[0_0_10px_rgba(255,51,102,0.8)]"></span>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Component to adjust bounds to fit all pins
function MapBounds({ pins }: { pins: LeakLocation[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    } else {
      map.setView([20, 0], 2);
    }
  }, [pins, map]);
  
  return null;
}

export function WorldMap({ pins, compact = false }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className={`w-full ${compact ? "aspect-[2/1]" : "aspect-[2/1]"} rounded-xl bg-surface/40`} />;

  return (
    <div className={`relative w-full ${compact ? "aspect-[2/1]" : "aspect-[2/1]"} rounded-xl overflow-hidden bg-[#0e0e0e] ring-1 ring-border`}>
      <MapContainer
        center={[20, 0]}
        zoom={2}
        className="w-full h-full z-0"
        zoomControl={!compact}
        attributionControl={false}
        scrollWheelZoom={!compact}
      >
        <TileLayer
          url="https://maps.geoapify.com/v1/tile/dark-matter/{z}/{x}/{y}.png?apiKey=85752f6b123847c2950125a5b3c9acae"
        />
        {pins.map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={leakIcon}>
            {!compact && (
              <Popup className="dark-popup">
                <div className="font-sans text-white">
                  <div className="font-semibold text-sm">{p.city || "Unknown Location"}, {p.country}</div>
                  <div className="text-xs text-white/70 mt-1">
                    {p.device} · {p.app}
                  </div>
                  <div className="text-xs font-mono text-crimson mt-1 font-bold">
                    {p.confidence}% match
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
        <MapBounds pins={pins} />
      </MapContainer>
      
      {/* Cyberpunk Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyber/10 pointer-events-none z-[1000]" />
    </div>
  );
}
