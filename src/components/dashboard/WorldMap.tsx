import { motion } from "framer-motion";
import type { LeakLocation } from "@/lib/dna";

type Props = {
  pins: LeakLocation[];
  compact?: boolean;
};

// Simple equirectangular projection -> SVG (viewBox 0 0 800 400)
function project(lat: number, lng: number): [number, number] {
  const x = ((lng + 180) / 360) * 800;
  const y = ((90 - lat) / 180) * 400;
  return [x, y];
}

// Stylized continent silhouettes (simple rounded rect blobs as background)
const continents: { x: number; y: number; w: number; h: number; rx: number }[] = [
  { x: 110, y: 90, w: 180, h: 110, rx: 30 }, // N. America
  { x: 230, y: 220, w: 90, h: 120, rx: 24 }, // S. America
  { x: 360, y: 90, w: 110, h: 100, rx: 22 }, // Europe
  { x: 380, y: 200, w: 110, h: 130, rx: 26 }, // Africa
  { x: 480, y: 100, w: 200, h: 150, rx: 30 }, // Asia
  { x: 600, y: 280, w: 80, h: 60, rx: 20 }, // Oceania
];

export function WorldMap({ pins, compact = false }: Props) {
  return (
    <div className={`relative w-full ${compact ? "aspect-[2/1]" : "aspect-[2/1]"} rounded-xl overflow-hidden bg-surface/40`}>
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-60" />
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-cyber/10" />

      <svg viewBox="0 0 800 400" className="relative w-full h-full">
        <defs>
          <radialGradient id="continentGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.72 0.16 235 / 0.35)" />
            <stop offset="100%" stopColor="oklch(0.72 0.16 235 / 0.05)" />
          </radialGradient>
          <filter id="pinGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Latitude lines */}
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={`h-${i}`}
            x1="0"
            x2="800"
            y1={(400 / 4) * i}
            y2={(400 / 4) * i}
            stroke="oklch(1 0 0 / 0.05)"
            strokeWidth="1"
          />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line
            key={`v-${i}`}
            y1="0"
            y2="400"
            x1={(800 / 8) * i}
            x2={(800 / 8) * i}
            stroke="oklch(1 0 0 / 0.05)"
            strokeWidth="1"
          />
        ))}

        {continents.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={c.w}
            height={c.h}
            rx={c.rx}
            fill="url(#continentGrad)"
            stroke="oklch(0.72 0.16 235 / 0.25)"
            strokeWidth="1"
          />
        ))}

        {/* Pins */}
        {pins.map((p, i) => {
          const [x, y] = project(p.lat, p.lng);
          return (
            <g key={i}>
              <motion.circle
                cx={x}
                cy={y}
                r="14"
                fill="oklch(0.65 0.24 25 / 0.25)"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
              <circle
                cx={x}
                cy={y}
                r="5"
                fill="oklch(0.65 0.24 25)"
                filter="url(#pinGlow)"
              />
              <circle cx={x} cy={y} r="2" fill="white" />
              <text
                x={x + 10}
                y={y - 8}
                fill="oklch(0.96 0.01 240)"
                fontSize="10"
                fontFamily="monospace"
              >
                {p.city}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
