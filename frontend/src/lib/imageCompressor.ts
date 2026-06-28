export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  outputType?: "image/jpeg" | "image/png";
}

export interface CompressDataUrlOptions extends CompressImageOptions {
  /** Max data-URL string length (Neon HTTP queries fail above ~64KB). */
  maxChars?: number;
}

/** Max safe length for question-bank figure data URLs (bulk question API). */
export const DB_SAFE_DATA_URL_CHARS = 52_000;

/**
 * Full practice-exam PDF pages — one image per PUT request, so much larger than figures.
 * Must match MAX_PRACTICE_EXAM_PAGE_DATA_URL_CHARS in functions/api/[[path]].ts.
 */
export const PRACTICE_EXAM_PAGE_DATA_URL_CHARS = 900_000;

/** Defaults for exam figures: preserve resolution, lower JPEG quality before downscaling. */
export const FIGURE_STORAGE_COMPRESS: CompressDataUrlOptions = {
  maxChars: DB_SAFE_DATA_URL_CHARS,
  maxWidth: 2800,
  maxHeight: 2800,
  quality: 0.93,
};

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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
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

function isDataImageUrl(url: string): boolean {
  return /^data:image\//i.test(url.trim());
}

async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image preview"));
  });
  return img;
}

function fitDimensions(
  srcW: number,
  srcH: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  let width = srcW;
  let height = srcH;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }
  return { width: Math.max(1, width), height: Math.max(1, height) };
}

function canvasToJpegDataUrl(
  img: HTMLImageElement,
  destW: number,
  destH: number,
  quality: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = destW;
  canvas.height = destH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, destW, destH);

  return canvas.toDataURL("image/jpeg", clamp(quality, 0.1, 0.95));
}

/**
 * Re-compresses an existing data URL so it fits DB / API size limits.
 * Prefers lowering JPEG quality before shrinking dimensions.
 */
export async function compressDataUrlIfLarge(
  dataUrl: string,
  {
    maxChars = DB_SAFE_DATA_URL_CHARS,
    maxWidth = FIGURE_STORAGE_COMPRESS.maxWidth!,
    maxHeight = FIGURE_STORAGE_COMPRESS.maxHeight!,
    quality = FIGURE_STORAGE_COMPRESS.quality!,
  }: CompressDataUrlOptions = {},
): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!isDataImageUrl(trimmed)) return trimmed;
  if (trimmed.length <= maxChars) return trimmed;

  const img = await loadImageFromDataUrl(trimmed);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw new Error("Invalid image dimensions");

  let { width, height } = fitDimensions(srcW, srcH, maxWidth, maxHeight);
  let best = trimmed;

  const qualitySteps = [
    quality,
    0.91,
    0.89,
    0.87,
    0.85,
    0.82,
    0.78,
    0.74,
    0.7,
    0.65,
    0.58,
    0.5,
  ];

  for (let scalePass = 0; scalePass < 10; scalePass += 1) {
    for (const q of qualitySteps) {
      const next = canvasToJpegDataUrl(img, width, height, q);
      best = next;
      if (next.length <= maxChars) return next;
    }
    width = Math.max(400, Math.round(width * 0.85));
    height = Math.max(300, Math.round(height * 0.85));
  }

  for (const q of [0.42, 0.35, 0.28]) {
    const next = canvasToJpegDataUrl(img, width, height, q);
    best = next;
    if (next.length <= maxChars) return next;
  }

  if (best.length > maxChars) {
    throw new Error(
      "Image is still too large after compression. Use less of the drawing area or clear empty space.",
    );
  }
  return best;
}

/** Defaults for imported practice-exam PDF pages (readable text, one page per save). */
export const EXAM_PAGE_STORAGE_COMPRESS: CompressDataUrlOptions = {
  maxChars: PRACTICE_EXAM_PAGE_DATA_URL_CHARS,
  maxWidth: 2800,
  maxHeight: 3600,
  quality: 0.94,
};

/** Quality-first compression for full exam booklet pages. */
export async function compressExamPageForStorage(dataUrl: string): Promise<string> {
  const opts = EXAM_PAGE_STORAGE_COMPRESS;
  const trimmed = dataUrl.trim();
  if (!isDataImageUrl(trimmed)) return trimmed;
  if (trimmed.length <= opts.maxChars!) return trimmed;

  const img = await loadImageFromDataUrl(trimmed);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) throw new Error("Invalid image dimensions");

  let { width, height } = fitDimensions(srcW, srcH, opts.maxWidth!, opts.maxHeight!);
  let best = trimmed;

  const qualitySteps = [opts.quality!, 0.92, 0.9, 0.88, 0.85, 0.82, 0.78];

  for (let scalePass = 0; scalePass < 5; scalePass += 1) {
    for (const q of qualitySteps) {
      const next = canvasToJpegDataUrl(img, width, height, q);
      best = next;
      if (next.length <= opts.maxChars!) return next;
    }
    width = Math.max(1600, Math.round(width * 0.94));
    height = Math.max(2100, Math.round(height * 0.94));
  }

  if (best.length > opts.maxChars!) {
    throw new Error(
      "Exam page image is still too large after compression. Try re-importing the PDF.",
    );
  }
  return best;
}

/** Compress a figure for DB storage using exam-friendly defaults. */
export async function compressFigureDataUrl(dataUrl: string): Promise<string> {
  return compressDataUrlIfLarge(dataUrl, FIGURE_STORAGE_COMPRESS);
}

/** Max data-URL length accepted by the marking API (must match server). */
export const MARKING_DATA_URL_CHARS = 220_000;

export const HANDWRITING_MARKING_COMPRESS: CompressDataUrlOptions = {
  maxChars: MARKING_DATA_URL_CHARS,
  maxWidth: 1600,
  maxHeight: 2200,
  quality: 0.88,
};

/**
 * Resize handwriting for vision marking — enough resolution to read strokes,
 * but capped so JPEG fits the API limit (no PNG mega-upscale).
 */
export async function prepareHandwritingForMarking(
  dataUrl: string,
  { maxChars = MARKING_DATA_URL_CHARS }: { maxChars?: number } = {},
): Promise<string> {
  const trimmed = dataUrl.trim();
  if (!isDataImageUrl(trimmed)) return trimmed;

  const img = await loadImageFromDataUrl(trimmed);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) return trimmed;

  const { maxWidth, maxHeight, quality } = HANDWRITING_MARKING_COMPRESS;
  let { width, height } = fitDimensions(srcW, srcH, maxWidth!, maxHeight!);

  const minW = 1100;
  const minH = 320;
  if (width < minW && srcW < maxWidth!) {
    const s = minW / width;
    width = Math.min(maxWidth!, Math.round(width * s));
    height = Math.min(maxHeight!, Math.round(height * s));
  }
  if (height < minH && srcH < maxHeight!) {
    const s = minH / height;
    width = Math.min(maxWidth!, Math.round(width * s));
    height = Math.min(maxHeight!, Math.round(height * s));
  }

  const jpeg = canvasToJpegDataUrl(img, width, height, quality!);
  if (jpeg.length <= maxChars) return jpeg;

  return compressDataUrlIfLarge(jpeg, { ...HANDWRITING_MARKING_COMPRESS, maxChars });
}

export async function compressDataUrlsForStorage(
  urls: string[],
  opts?: CompressDataUrlOptions,
): Promise<string[]> {
  return Promise.all(urls.map((u) => compressDataUrlIfLarge(u, opts)));
}
