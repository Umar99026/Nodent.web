export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  outputType?: "image/jpeg" | "image/png";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Compresses an image file in-browser and returns a data URL.
 * This is used for drag/drop image inputs without needing server uploads.
 */
export async function compressImageFileToDataUrl(
  file: File,
  {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.7,
    outputType = "image/jpeg",
  }: CompressImageOptions = {},
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load dropped image"));
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) throw new Error("Invalid image dimensions");

    const scale = Math.min(1, maxWidth / srcW, maxHeight / srcH);
    const destW = Math.max(1, Math.round(srcW * scale));
    const destH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = destW;
    canvas.height = destH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported");
    ctx.drawImage(img, 0, 0, destW, destH);

    if (outputType === "image/png") {
      return canvas.toDataURL("image/png");
    }

    const q = clamp(quality, 0.1, 0.95);
    return canvas.toDataURL("image/jpeg", q);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

