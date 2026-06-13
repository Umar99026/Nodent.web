export type CropRect = {
  /** 0–1 relative to image width */
  x: number;
  y: number;
  w: number;
  h: number;
};

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

/** JPEG quality when exporting a crop (keep high — crops are often re-encoded). */
export const PDF_CROP_JPEG_QUALITY = 0.93;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        settled = true;
        resolve(img);
        return;
      }
      settled = true;
      reject(new Error("Could not load image for cropping."));
    };
    img.onload = finish;
    img.onerror = () => {
      if (settled) return;
      settled = true;
      reject(new Error("Could not load image for cropping."));
    };
    img.src = src;
    if (img.complete) finish();
  });
}

export async function cropImageDataUrl(
  src: string,
  rect: CropRect,
  quality = PDF_CROP_JPEG_QUALITY,
): Promise<string> {
  const img = await loadImageElement(src);

  const sw = img.naturalWidth;
  const sh = img.naturalHeight;
  const x = Math.max(0, Math.min(sw - 1, Math.round(rect.x * sw)));
  const y = Math.max(0, Math.min(sh - 1, Math.round(rect.y * sh)));
  const w = Math.max(1, Math.min(sw - x, Math.round(rect.w * sw)));
  const h = Math.max(1, Math.min(sh - y, Math.round(rect.h * sh)));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}
