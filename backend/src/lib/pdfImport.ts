import { PNG } from "pngjs/browser";

/**
 * Cloudflare Workers (and some local runtimes) do not provide DOMMatrix yet.
 * pdfjs checks for it at module init time, so we polyfill before loading pdfjs.
 */
function ensureDomMatrix() {
  if ((globalThis as any).DOMMatrix) return;
  class DOMMatrixPolyfill {
    a = 1;
    b = 0;
    c = 0;
    d = 1;
    e = 0;
    f = 0;
    constructor(init?: any) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = Number(init[0]);
        this.b = Number(init[1]);
        this.c = Number(init[2]);
        this.d = Number(init[3]);
        this.e = Number(init[4]);
        this.f = Number(init[5]);
      } else if (init && typeof init === "object") {
        // fromMatrix({a,b,c,d,e,f})
        this.a = Number(init.a ?? 1);
        this.b = Number(init.b ?? 0);
        this.c = Number(init.c ?? 0);
        this.d = Number(init.d ?? 1);
        this.e = Number(init.e ?? 0);
        this.f = Number(init.f ?? 0);
      }
    }
    multiply(other: any) {
      const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
      const a = this.a * o.a + this.c * o.b;
      const b = this.b * o.a + this.d * o.b;
      const c = this.a * o.c + this.c * o.d;
      const d = this.b * o.c + this.d * o.d;
      const e = this.a * o.e + this.c * o.f + this.e;
      const f = this.b * o.e + this.d * o.f + this.f;
      return new DOMMatrixPolyfill([a, b, c, d, e, f]);
    }
    static fromMatrix(init?: any) {
      return new DOMMatrixPolyfill(init);
    }
  }
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}

function ensureNavigator() {
  const g: any = globalThis as any;
  if (!g.navigator) g.navigator = {};
  if (!g.navigator.userAgent) g.navigator.userAgent = "Cloudflare-Workers";
  if (g.navigator.platform == null) g.navigator.platform = "Workers";
}

async function loadPdfJs() {
  ensureDomMatrix();
  ensureNavigator();
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
  // Workers runtime: force single-thread parsing and never attempt a worker module.
  (pdfjs as any).disableWorker = true;
  if (pdfjs?.GlobalWorkerOptions) {
    (pdfjs as any).GlobalWorkerOptions.workerSrc =
      "pdfjs-dist/legacy/build/pdf.worker.mjs";
    (pdfjs as any).GlobalWorkerOptions.workerPort = null;
  }
  return pdfjs;
}

export type PdfExtractedQuestion = {
  type: "mcq" | "short_answer" | "long_answer";
  topic?: string;
  question: string;
  passage?: string;
  options?: string[];
  answer?: string;
  acceptedAnswers?: string[];
  guidance?: string;
  marks?: number;
  imageUrls?: string[];
  sourcePage: number;
};

function decodePdfLiteralString(s: string): string {
  return s
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function joinPdfTextItems(items: any[]): string {
  let out = "";
  for (const it of items) {
    const s = String(it?.str ?? "");
    if (!s) continue;
    out += s;
    if (it?.hasEOL) out += "\n";
    else out += " ";
  }
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitIntoNumberedQuestions(text: string): string[] {
  const lines = text.split("\n");
  const blocks: string[] = [];
  let cur: string[] = [];

  const isStart = (line: string) => /^\s*\d{1,3}[.)]\s+/.test(line);

  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    if (isStart(line)) {
      if (cur.length) blocks.push(cur.join("\n").trim());
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join("\n").trim());
  return blocks
    .map((b) => b.replace(/\n{3,}/g, "\n\n").trim())
    .filter(Boolean);
}

function splitFallbackQuestions(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const paras = t
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter((p) => p.length >= 25);
  if (paras.length) return paras.slice(0, 24);
  return [t];
}

function splitByQuestionHeadings(text: string): string[] {
  const normalized = text.replace(/\r/g, "");
  const headingRe =
    /(?:^|\n)\s*(?:question\s*\d{1,3}\b|q\s*\d{1,3}\b|\d{1,3}[.)]\s+)/gi;
  const matches = [...normalized.matchAll(headingRe)];
  if (matches.length === 0) return [];
  const out: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index ?? 0;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]!.index ?? normalized.length)
        : normalized.length;
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length >= 25) out.push(chunk);
  }
  return out;
}

/**
 * Last-resort parser used when pdfjs extraction fails in local/runtime edge-cases.
 * Tries to recover readable text from PDF operators so we can still generate questions.
 */
export function extractQuestionsFromPdfFallback(params: {
  pdfBytes: ArrayBuffer;
  maxQuestions?: number;
}): {
  questions: PdfExtractedQuestion[];
  pageCount: number;
  mode: "numbered" | "heading" | "loose";
} {
  const bytes = new Uint8Array(params.pdfBytes);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]!);

  const textBlocks = [...raw.matchAll(/BT([\s\S]*?)ET/g)].map((m) => m[1] ?? "");
  const extractedLines: string[] = [];

  for (const b of textBlocks) {
    // Simple text show operator: (....) Tj
    for (const m of b.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      const text = decodePdfLiteralString(m[1] ?? "").trim();
      if (text.length >= 2) extractedLines.push(text);
    }
    // Array text show operator: [ (...) (...) ] TJ
    for (const m of b.matchAll(/\[(.*?)\]\s*TJ/gs)) {
      const inner = m[1] ?? "";
      const parts = [...inner.matchAll(/\(((?:\\.|[^\\)])*)\)/g)]
        .map((x) => decodePdfLiteralString(x[1] ?? "").trim())
        .filter(Boolean);
      if (parts.length) extractedLines.push(parts.join(" "));
    }
  }

  // If no BT/ET text operators found, try a narrow fallback on Tj only.
  if (extractedLines.length === 0) {
    for (const m of raw.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) {
      const text = decodePdfLiteralString(m[1] ?? "").trim();
      if (text.length >= 2) extractedLines.push(text);
    }
  }

  const cleaned = extractedLines
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !/^\/?(Type|Font|Catalog|Page|MediaBox)\b/i.test(t))
    .slice(0, 500);

  const combined = cleaned.join("\n");
  const numbered = splitIntoNumberedQuestions(combined);
  const headingSplit = splitByQuestionHeadings(combined);
  const looseSplit = splitFallbackQuestions(combined);
  const mode: "numbered" | "heading" | "loose" = numbered.length
    ? "numbered"
    : headingSplit.length
      ? "heading"
      : "loose";
  const questionBlocks =
    mode === "numbered"
      ? numbered
      : mode === "heading"
        ? headingSplit
        : looseSplit;
  const maxQuestions = Math.max(1, Math.min(80, params.maxQuestions ?? 30));

  const questions: PdfExtractedQuestion[] = questionBlocks.slice(0, maxQuestions).map((b) => {
    const mcq = parseMcq(b);
    if (mcq) {
      return {
        type: "mcq",
        question: mcq.stem,
        options: mcq.options,
        marks: 1,
        sourcePage: 1,
      };
    }
    return {
      type: "long_answer",
      question: b,
      marks: 2,
      sourcePage: 1,
    };
  });

  return { questions, pageCount: 1, mode };
}

function parseMcq(block: string): { stem: string; options: string[] } | null {
  const lines = block.split("\n");
  const optRe = /^\s*([A-H])[\).\]]\s+(.*)$/;
  const options: { key: string; text: string }[] = [];

  for (const l of lines) {
    const m = l.match(optRe);
    if (!m) continue;
    options.push({ key: m[1]!, text: m[2]!.trim() });
  }

  if (options.length < 2) return null;

  const firstOptIdx = lines.findIndex((l) => optRe.test(l));
  const stemLines = (firstOptIdx >= 0 ? lines.slice(0, firstOptIdx) : lines)
    .join("\n")
    .trim();

  const ordered = options
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((o) => o.text)
    .filter(Boolean);

  return ordered.length >= 2 ? { stem: stemLines, options: ordered } : null;
}

async function getPdfImageObject(page: any, objId: string): Promise<any | null> {
  const objs = page?.objs;
  if (!objs) return null;
  try {
    if (typeof objs.get === "function") {
      if (objs.get.length >= 2) {
        return await new Promise((resolve) => {
          try {
            objs.get(objId, (v: any) => resolve(v ?? null));
          } catch {
            resolve(null);
          }
        });
      }
      const v = objs.get(objId);
      return v ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function rgbaToPngDataUrl(width: number, height: number, rgba: Uint8Array): string {
  const png = new PNG({ width, height });
  // pngjs expects a Buffer-like
  (png.data as unknown as Uint8Array).set(rgba);
  const bytes = PNG.sync.write(png);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const b64 = btoa(bin);
  return `data:image/png;base64,${b64}`;
}

function downscaleRgba(
  srcW: number,
  srcH: number,
  src: Uint8Array,
  maxPixels: number,
): { width: number; height: number; data: Uint8Array } {
  const srcPixels = srcW * srcH;
  if (srcPixels <= maxPixels) {
    return { width: srcW, height: srcH, data: src };
  }

  const scale = Math.sqrt(maxPixels / srcPixels);
  const dstW = Math.max(1, Math.floor(srcW * scale));
  const dstH = Math.max(1, Math.floor(srcH * scale));
  const dst = new Uint8Array(dstW * dstH * 4);

  // Nearest-neighbour downscale keeps this cheap inside Workers.
  for (let y = 0; y < dstH; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      dst[di] = src[si]!;
      dst[di + 1] = src[si + 1]!;
      dst[di + 2] = src[si + 2]!;
      dst[di + 3] = src[si + 3]!;
    }
  }

  return { width: dstW, height: dstH, data: dst };
}

async function extractPageImages(page: any, maxImages: number): Promise<string[]> {
  const out: string[] = [];
  try {
    const opList = await page.getOperatorList();
    const pdfjsLib = await loadPdfJs();
    const OPS = (pdfjsLib as any).OPS as Record<string, number>;
    const paintOps = new Set<number>([
      OPS.paintImageXObject,
      OPS.paintJpegXObject,
      OPS.paintImageXObjectRepeat,
      OPS.paintJpegXObjectRepeat,
    ].filter((x) => typeof x === "number"));

    for (let i = 0; i < opList.fnArray.length; i++) {
      if (out.length >= maxImages) break;
      const fn = opList.fnArray[i] as number;
      if (!paintOps.has(fn)) continue;
      const args = opList.argsArray[i] as any[];
      const objId = String(args?.[0] ?? "");
      if (!objId) continue;
      const img = await getPdfImageObject(page, objId);
      const w = Number(img?.width ?? 0);
      const h = Number(img?.height ?? 0);
      const data = img?.data as Uint8Array | undefined;
      if (!w || !h || !data || data.length < w * h * 4) continue;

      // Keep extraction robust on Workers: downscale huge images instead of skipping.
      const reduced = downscaleRgba(w, h, data, 2_500_000);
      out.push(rgbaToPngDataUrl(reduced.width, reduced.height, reduced.data));
    }
  } catch {
    return out;
  }
  return out;
}

export async function extractQuestionsFromPdf(params: {
  pdfBytes: ArrayBuffer;
  maxPages?: number;
  maxImagesPerPage?: number;
}): Promise<{ questions: PdfExtractedQuestion[]; pageCount: number }> {
  const maxPages = Math.max(1, Math.min(200, params.maxPages ?? 50));
  const maxImagesPerPage = Math.max(0, Math.min(10, params.maxImagesPerPage ?? 4));

  const pdfjsLib = await loadPdfJs();
  const pdf = await (pdfjsLib as any).getDocument({
    data: new Uint8Array(params.pdfBytes),
    useSystemFonts: true,
    // Cloudflare Workers cannot spawn a PDF.js worker script path.
    disableWorker: true,
  }).promise;

  const pageCount = Number(pdf.numPages || 0);
  const usePages = Math.min(pageCount, maxPages);
  const out: PdfExtractedQuestion[] = [];

  for (let p = 1; p <= usePages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const pageText = joinPdfTextItems(textContent.items ?? []);
    const numbered = splitIntoNumberedQuestions(pageText);
    const blocks = numbered.length ? numbered : splitFallbackQuestions(pageText);
    const pageImages = maxImagesPerPage > 0 ? await extractPageImages(page, maxImagesPerPage) : [];

    // If we got no parseable text, still generate one question shell for image-only pages.
    if (blocks.length === 0 && pageImages.length > 0) {
      out.push({
        type: "long_answer",
        question: `Refer to the attached figure from page ${p}.`,
        marks: 2,
        imageUrls: pageImages,
        sourcePage: p,
      });
      continue;
    }

    for (const block of blocks) {
      const mcq = parseMcq(block);
      if (mcq) {
        out.push({
          type: "mcq",
          question: mcq.stem,
          options: mcq.options,
          marks: 1,
          imageUrls: pageImages.length ? pageImages : undefined,
          sourcePage: p,
        });
      } else {
        out.push({
          type: "long_answer",
          question: block,
          marks: 2,
          imageUrls: pageImages.length ? pageImages : undefined,
          sourcePage: p,
        });
      }
    }
  }

  return { questions: out, pageCount };
}

