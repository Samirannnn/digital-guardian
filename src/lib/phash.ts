export const API_BASE = "https://phash-api-343477732259.asia-south1.run.app";

/**
 * Generate a perceptual hash from an image File.
 * EXACTLY mirrors the Kotlin PHashGenerator:
 *   1. Resize to 32×32
 *   2. Grayscale: Math.trunc(0.299R + 0.587G + 0.114B)  — integer, like Kotlin .toInt()
 *   3. DCT on 32×32 matrix
 *   4. Extract top-left 8×8 (64 values — low-frequency features)
 *   5. Median = sorted[32]  (Kotlin: sorted[sorted.size / 2] = sorted[32])
 *   6. bits: value > median → '1', else '0'
 *   7. Binary → 16-char hex string
 */
export async function generatePHash(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 32;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get canvas context");

        // Step 1: Draw and scale to 32×32
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const data = imgData.data;

        const n = 32;

        // Step 2: Grayscale — integer truncation matching Kotlin's .toInt()
        // Kotlin: grayscale[y][x] = (0.299 * r + 0.587 * g + 0.114 * b).toInt()
        const grayscale = new Float64Array(n * n);
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          grayscale[i / 4] = Math.trunc(0.299 * r + 0.587 * g + 0.114 * b);
        }

        // Step 3: DCT — exact match to Kotlin applyDCT
        // Kotlin loops: for u, for v, for x, for y
        // pixel = matrix[y][x]  →  grayscale[y * n + x]
        const dct: Float64Array[] = Array.from({ length: n }, () => new Float64Array(n));

        for (let u = 0; u < n; u++) {
          for (let v = 0; v < n; v++) {
            let sum = 0.0;
            for (let x = 0; x < n; x++) {
              for (let y = 0; y < n; y++) {
                const pixel = grayscale[y * n + x];
                sum +=
                  pixel *
                  Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n)) *
                  Math.cos(((2 * y + 1) * v * Math.PI) / (2 * n));
              }
            }
            const cu = u === 0 ? 1.0 / Math.sqrt(2.0) : 1.0;
            const cv = v === 0 ? 1.0 / Math.sqrt(2.0) : 1.0;
            dct[u][v] = (2.0 / n) * cu * cv * sum;
          }
        }

        // Step 4: Extract top-left 8×8
        // Kotlin: for y in 0 until HASH_SIZE, for x in 0 until HASH_SIZE
        const dctValues = new Float64Array(64);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            dctValues[y * 8 + x] = dct[y][x];
          }
        }

        // Step 5: Median — Kotlin: sorted[sorted.size / 2] = sorted[64/2] = sorted[32]
        const sorted = Float64Array.from(dctValues).sort();
        const median = sorted[32]; // exact match to Kotlin

        // Step 6: Generate binary string
        let binaryStr = "";
        for (let i = 0; i < 64; i++) {
          binaryStr += dctValues[i] > median ? "1" : "0";
        }

        // Step 7: Binary → hex (4 bits per char → 16 hex chars total)
        let hexHash = "";
        for (let i = 0; i < binaryStr.length; i += 4) {
          const chunk = binaryStr.substring(i, Math.min(i + 4, binaryStr.length));
          const val = parseInt(chunk, 2);
          hexHash += val.toString(16);
        }

        resolve(hexHash);
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(e);

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) img.src = e.target.result as string;
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

// ─── Cloud Run API Functions ──────────────────────────────────────────────────

/** Search blockchain for an existing pHash — returns match + owner + similarity */
export async function searchPHash(
  phash: string,
): Promise<{ match_found: boolean; user_id: string; sim: number }> {
  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: phash }),
    });
    if (!res.ok) throw new Error(`Search API ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("searchPHash error:", error);
    return { match_found: false, user_id: "", sim: 0 };
  }
}

/** Register a pHash on-chain under the owner's email */
export async function protectPHash(phash: string, owner: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: phash, user_id: owner }),
    });
    if (!res.ok) throw new Error(`Protect API ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("protectPHash error:", error);
    return null;
  }
}

/** Check if a pHash is flagged for blur enforcement */
export async function getEnforcement(
  phash: string,
): Promise<{ isEnforced: boolean; ownerId: string }> {
  try {
    const res = await fetch(`${API_BASE}/enforcement?phash=${phash}`);
    if (!res.ok) throw new Error(`Enforcement API ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("getEnforcement error:", error);
    return { isEnforced: false, ownerId: "" };
  }
}

/** Trigger blur enforcement — authorized owner blurs image on all devices */
export async function enforceBlur(
  phash: string,
  owner: string,
): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/enforce`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: phash, user_id: owner, action: "blur" }),
    });
    if (!res.ok) throw new Error(`Enforce API ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("enforceBlur error:", error);
    return { success: false };
  }
}

/** Transfer ownership of a pHash to a new email/user */
export async function transferOwnership(
  phash: string,
  currentOwner: string,
  newOwner: string,
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hash: phash,
        current_owner: currentOwner,
        new_owner: newOwner,
      }),
    });
    if (!res.ok) throw new Error(`Transfer API ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("transferOwnership error:", error);
    return { success: false, message: String(error) };
  }
}

/** Compare two hex pHash strings — returns similarity 0.0–1.0 via Hamming distance */
export function comparePHash(hash1: string, hash2: string): number {
  const toBin = (hex: string) =>
    hex
      .split("")
      .map((c) => parseInt(c, 16).toString(2).padStart(4, "0"))
      .join("");
  const b1 = toBin(hash1);
  const b2 = toBin(hash2);
  if (b1.length !== b2.length) return 0;
  let matches = 0;
  for (let i = 0; i < b1.length; i++) if (b1[i] === b2[i]) matches++;
  return matches / b1.length;
}
