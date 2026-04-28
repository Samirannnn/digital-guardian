export const API_BASE = "https://phash-api-343477732259.asia-south1.run.app";

/**
 * Generate a perceptual hash from an image File using DCT algorithm.
 * Replicates the Android PHashGenerator algorithm.
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
        
        // Draw and scale image to 32x32
        ctx.drawImage(img, 0, 0, 32, 32);
        const imgData = ctx.getImageData(0, 0, 32, 32);
        const data = imgData.data;

        // 1. Convert to grayscale (luminance formula: 0.299R + 0.587G + 0.114B)
        const n = 32;
        const grayscale = new Float64Array(n * n);
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const pixelIndex = i / 4;
          grayscale[pixelIndex] = 0.299 * r + 0.587 * g + 0.114 * b;
        }

        // 2. Apply DCT
        // Pre-compute cosines for optimization
        const cosines = new Float64Array(n * n);
        for (let x = 0; x < n; x++) {
          for (let u = 0; u < n; u++) {
            cosines[x * n + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * n));
          }
        }

        const dct = Array(n).fill(0).map(() => new Float64Array(n));
        
        for (let u = 0; u < n; u++) {
          for (let v = 0; v < n; v++) {
            let sum = 0;
            for (let x = 0; x < n; x++) {
              for (let y = 0; y < n; y++) {
                const pixel = grayscale[y * n + x];
                sum += pixel * cosines[x * n + u] * cosines[y * n + v];
              }
            }
            const cu = u === 0 ? 1.0 / Math.sqrt(2.0) : 1.0;
            const cv = v === 0 ? 1.0 / Math.sqrt(2.0) : 1.0;
            dct[u][v] = (2.0 / n) * cu * cv * sum;
          }
        }

        // 3. Extract top-left 8x8
        const dctValues = new Float64Array(64);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            dctValues[y * 8 + x] = dct[y][x];
          }
        }

        // 4. Calculate median
        // Create a copy to sort since Float64Array.sort sorts in place
        const sorted = new Float64Array(dctValues).sort();
        const median = sorted[32]; // 32nd index is the median (length 64)

        // 5. Generate hash
        let binaryStr = "";
        for (let i = 0; i < 64; i++) {
          binaryStr += dctValues[i] > median ? "1" : "0";
        }

        // 6. Convert to hex
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

// API Functions
export async function searchPHash(phash: string): Promise<{ matchFound: boolean; owner: string; sim: number }> {
  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: phash })
    });
    if (!res.ok) throw new Error("Search API failed");
    return await res.json();
  } catch (error) {
    console.error("searchPHash error:", error);
    return { matchFound: false, owner: "", sim: 0 };
  }
}

export async function protectPHash(phash: string, owner: string): Promise<any> {
  try {
    const res = await fetch(`${API_BASE}/protect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: phash, owner })
    });
    if (!res.ok) throw new Error("Protect API failed");
    return await res.json();
  } catch (error) {
    console.error("protectPHash error:", error);
    return null;
  }
}

export async function getEnforcement(phash: string): Promise<{ isEnforced: boolean; ownerId: string }> {
  try {
    const res = await fetch(`${API_BASE}/enforcement?phash=${phash}`);
    if (!res.ok) throw new Error("Enforcement API failed");
    return await res.json();
  } catch (error) {
    console.error("getEnforcement error:", error);
    return { isEnforced: false, ownerId: "" };
  }
}
