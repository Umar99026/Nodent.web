import {
  openPdfDocument,
  PDF_RENDER_STANDARD,
  renderPageToDataUrl,
} from "@/lib/pdfQuestionImport";

export type PdfTextSpan = {
  str: string;
  leftPct: number;
  topPct: number;
  widthPct: number;
  fontSizePx: number;
};

export type PdfPageView = {
  pageNumber: number;
  imageDataUrl: string;
  width: number;
  height: number;
  textSpans: PdfTextSpan[];
};

async function buildTextSpans(
  page: import("pdfjs-dist").PDFPageProxy,
  viewport: import("pdfjs-dist").PageViewport,
): Promise<PdfTextSpan[]> {
  const pdfjs = await import("pdfjs-dist");
  const content = await page.getTextContent();
  const spans: PdfTextSpan[] = [];

  for (const raw of content.items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const item = raw as { str: string; transform: number[]; width?: number };
    if (!item.str?.trim()) continue;

    const tm = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontSize = Math.hypot(tm[2] ?? 0, tm[3] ?? 0) || 12;
    const left = tm[4] ?? 0;
    const top = (tm[5] ?? 0) - fontSize;
    const width = (item.width ?? item.str.length * 0.5) * fontSize;

    spans.push({
      str: item.str,
      leftPct: (left / viewport.width) * 100,
      topPct: (top / viewport.height) * 100,
      widthPct: Math.min(40, (width / viewport.width) * 100),
      fontSizePx: fontSize,
    });
  }

  return spans;
}

export async function loadPdfPageView(
  doc: import("pdfjs-dist").PDFDocumentProxy,
  pageNumber: number,
): Promise<PdfPageView> {
  const page = await doc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const maxWidth = PDF_RENDER_STANDARD.maxWidth ?? 1600;
  const maxScale = PDF_RENDER_STANDARD.maxScale ?? 2.5;
  const scale = Math.min(maxScale, maxWidth / Math.max(1, baseViewport.width));
  const viewport = page.getViewport({ scale });

  const [imageDataUrl, textSpans] = await Promise.all([
    renderPageToDataUrl(page, { ...PDF_RENDER_STANDARD, maxWidth }),
    buildTextSpans(page, viewport),
  ]);

  return {
    pageNumber,
    imageDataUrl,
    width: viewport.width,
    height: viewport.height,
    textSpans,
  };
}

export { openPdfDocument };
