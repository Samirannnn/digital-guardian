/**
 * Generates a fake but realistic-looking pHash signature.
 */
export function generateMockHash(seed?: string): string {
  const base = seed ?? Math.random().toString(36);
  let h = 0;
  for (let i = 0; i < base.length; i++) {
    h = (h * 31 + base.charCodeAt(i)) >>> 0;
  }
  const chars = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 64; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    out += chars[(h >>> (i % 28)) & 0xf];
  }
  return out;
}

export type LeakLocation = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  device: string;
  app: string;
  confidence: number;
  timestamp: string;
};

export type ScanResult = {
  hash: string;
  status: "clean" | "leaked";
  scannedAt: string;
  blockNumber: number;
  locations: LeakLocation[];
};

const cities: Omit<LeakLocation, "device" | "app" | "confidence" | "timestamp">[] = [
  { city: "Kolkata", country: "IN", lat: 22.57, lng: 88.36 },
  { city: "Mumbai", country: "IN", lat: 19.07, lng: 72.88 },
  { city: "Dubai", country: "AE", lat: 25.27, lng: 55.3 },
  { city: "Jakarta", country: "ID", lat: -6.21, lng: 106.85 },
  { city: "Lagos", country: "NG", lat: 6.52, lng: 3.38 },
  { city: "São Paulo", country: "BR", lat: -23.55, lng: -46.63 },
];

const devices = ["Realme 8", "Samsung A52", "iPhone 13", "Pixel 7", "OnePlus Nord", "Xiaomi 12"];
const apps = ["WhatsApp", "Telegram", "Instagram DM", "Signal", "Snapchat"];

/**
 * Simulates a 3-second blockchain query for the image's pHash.
 * TODO: Connect to Polygon/Smart Contract here
 */
export function simulateBlockchainCheck(file: File): Promise<ScanResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const hash = generateMockHash(file.name + file.size);
      // Demo trick: file name containing "whatsapp" or "leak" forces a match
      const forceLeak = /whats|leak|test/i.test(file.name);
      const isLeak = forceLeak || Math.random() > 0.45;

      if (!isLeak) {
        resolve({
          hash,
          status: "clean",
          scannedAt: new Date().toISOString(),
          blockNumber: 18_452_193 + Math.floor(Math.random() * 999),
          locations: [],
        });
        return;
      }

      const count = forceLeak ? 1 : 1 + Math.floor(Math.random() * 3);
      const locations: LeakLocation[] = Array.from({ length: count }).map((_, i) => {
        const c = forceLeak ? cities[0] : cities[Math.floor(Math.random() * cities.length)];
        return {
          ...c,
          device: forceLeak && i === 0 ? "Realme 8" : devices[Math.floor(Math.random() * devices.length)],
          app: forceLeak && i === 0 ? "WhatsApp" : apps[Math.floor(Math.random() * apps.length)],
          confidence: forceLeak && i === 0 ? 94 : 72 + Math.floor(Math.random() * 25),
          timestamp: new Date(Date.now() - Math.random() * 86_400_000 * 3).toISOString(),
        };
      });

      resolve({
        hash,
        status: "leaked",
        scannedAt: new Date().toISOString(),
        blockNumber: 18_452_193 + Math.floor(Math.random() * 999),
        locations,
      });
    }, 3000);
  });
}
