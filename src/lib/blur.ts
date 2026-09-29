import { supabase } from "@/integrations/supabase/client";

/**
 * Blur strength preset values:
 * Low: 10
 * Medium: 20
 * High: 35
 * Extreme: 50
 */
export const BLUR_PRESETS = [
  { label: "Low", value: 10 },
  { label: "Medium", value: 20 },
  { label: "High", value: 35 },
  { label: "Extreme", value: 50 },
] as const;

/**
 * Apply a multi-pass Gaussian/box blur to a canvas context.
 */
function applyCanvasBlur(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number
) {
  // Use filter context if available
  if ("filter" in ctx) {
    ctx.filter = `blur(${radius}px)`;
    return;
  }

  // Fallback box blur implementation for older canvas contexts
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const passes = 3;

  for (let p = 0; p < passes; p++) {
    for (let i = 0; i < data.length; i += 4) {
      // Light pixel blending
      if (i > 4 && i < data.length - 4) {
        data[i] = (data[i - 4] + data[i] + data[i + 4]) / 3;
        data[i + 1] = (data[i - 3] + data[i + 1] + data[i + 5]) / 3;
        data[i + 2] = (data[i - 2] + data[i + 2] + data[i + 6]) / 3;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Create a real blurred preview image blob from a File or image URL.
 */
export async function createBlurredPreviewBlob(
  source: File | string,
  blurRadius: number = 20
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const isFile = source instanceof File;
    const isImage = isFile ? source.type.startsWith("image/") : true;

    if (!isImage && isFile) {
      // Non-image file placeholder generation
      const canvas = document.createElement("canvas");
      canvas.width = 600;
      canvas.height = 400;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Could not get canvas context"));

      // Dark styled placeholder
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🔒 Protected Asset", 300, 180);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px sans-serif";
      ctx.fillText("Preview unavailable while protection is enabled", 300, 220);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas blob export failed"));
      }, "image/webp", 0.9);
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Downscale slightly for smooth blur processing & fast load
        const maxDim = 800;
        let w = img.width || 800;
        let h = img.height || 600;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Could not get canvas context"));

        // Step 1: Draw image
        ctx.drawImage(img, 0, 0, w, h);

        // Step 2: Apply Gaussian blur filter
        ctx.filter = `blur(${Math.max(5, blurRadius)}px)`;
        ctx.drawImage(canvas, 0, 0, w, h);

        // Additional pass for heavy blur
        if (blurRadius >= 35) {
          ctx.filter = `blur(${Math.round(blurRadius / 2)}px)`;
          ctx.drawImage(canvas, 0, 0, w, h);
        }

        // Reset filter
        ctx.filter = "none";

        // Step 3: Draw semi-transparent lock overlay directly onto the blurred pixels
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, 0, w, h);

        // Step 4: Export blurred preview as compressed WebP blob
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to generate blurred image blob"));
          },
          "image/webp",
          0.85
        );
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => reject(err);

    if (isFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) img.src = e.target.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(source as File);
    } else {
      img.src = source as string;
    }
  });
}

/**
 * Upload a generated blurred preview to Supabase Storage and return the storage path.
 */
export async function uploadProtectedPreview(
  userId: string,
  assetId: string,
  source: File | string,
  blurStrength: number = 20
): Promise<string> {
  const blob = await createBlurredPreviewBlob(source, blurStrength);
  const path = `${userId}/protected/${assetId}-blurred.webp`;

  const { error } = await supabase.storage.from("assets").upload(path, blob, {
    cacheControl: "3600",
    upsert: true,
    contentType: "image/webp",
  });

  if (error) {
    console.error("Failed to upload protected preview:", error);
    throw error;
  }

  return path;
}
