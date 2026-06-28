import type { PdfTextSpan } from "@/lib/createPdfPageView";
import {
  clampOverlay,
  type DiagramLabelPart,
  partHasOverlay,
} from "@/lib/diagramLabels";
import { isMeaningfulCropRect, type CropRect } from "@/lib/pdfImageCrop";

export type DetectedInputMarker = DiagramLabelPart & {
  /** Sub-part letter when marker is [[INPUT:b:1]] */
  partKey?: string;
  order: number;
};

const INPUT_TOKEN_RE =
  /\[\[INPUT(?:\:([a-z])(?:\:([\w]+))?|:([\w]+))?\]\]/gi;

function parseInputMarkerToken(
  text: string,
): { partKey?: string; boxKey: string } | null {
  const m = text.match(
    /\[\[INPUT(?:\:([a-z])(?:\:([\w]+))?|:([\w]+))?\]\]/i,
  );
  if (!m) return null;
  const partLetter = m[1]?.trim().toLowerCase();
  const partSubKey = m[2]?.trim();
  const questionKey = m[3]?.trim();
  if (partLetter && /^[a-z]$/.test(partLetter)) {
    return {
      partKey: partLetter,
      boxKey: partSubKey || "1",
    };
  }
  if (questionKey) {
    return { boxKey: questionKey };
  }
  return { boxKey: "" };
}

function isVisualBlankToken(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (parseInputMarkerToken(t)) return true;
  if (/^□+$|^\u25A1+$|^⬜+$/.test(t)) return true;
  if (/^_{3,}$/.test(t)) return true;
  if (/^\[\s*\]$/.test(t)) return true;
  if (/^\.{3,}$/.test(t)) return true;
  return false;
}

function extractMarkersFromSpan(str: string): Array<{ partKey?: string; boxKey: string }> {
  const found: Array<{ partKey?: string; boxKey: string }> = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(INPUT_TOKEN_RE.source, "gi");
  while ((m = re.exec(str)) !== null) {
    const parsed = parseInputMarkerToken(m[0] ?? "");
    if (parsed) found.push(parsed);
  }
  if (!found.length && isVisualBlankToken(str)) {
    found.push({ boxKey: "" });
  }
  return found;
}

function overlayFromSpan(span: PdfTextSpan): Pick<DiagramLabelPart, "overlayX" | "overlayY" | "overlayW" | "overlayH"> {
  const w = Math.max(12, Math.min(28, span.widthPct || 16));
  const h = Math.max(6, Math.min(14, (span.fontSizePx / 12) * 7));
  return clampOverlay({
    overlayX: span.leftPct,
    overlayY: span.topPct,
    overlayW: w,
    overlayH: h,
  });
}

/** Scan PDF text layer for [[INPUT]] markers and visual blanks; positions are % of the page image. */
export function detectInputBoxMarkersFromSpans(
  spans: PdfTextSpan[],
  options?: { minTopPct?: number; maxTopPct?: number },
): DetectedInputMarker[] {
  const minTop = options?.minTopPct ?? 0;
  const maxTop = options?.maxTopPct ?? 100;
  const markers: DetectedInputMarker[] = [];
  let order = 0;

  const sorted = [...spans].sort((a, b) => {
    const yDiff = a.topPct - b.topPct;
    if (Math.abs(yDiff) > 0.5) return yDiff;
    return a.leftPct - b.leftPct;
  });

  for (const span of sorted) {
    if (span.topPct < minTop || span.topPct > maxTop) continue;
    const tokens = extractMarkersFromSpan(span.str);
    if (!tokens.length) continue;

    const layout = overlayFromSpan(span);
    for (const token of tokens) {
      order += 1;
      markers.push({
        ...layout,
        key: token.boxKey || String(order),
        partKey: token.partKey,
        label: token.partKey
          ? `Part ${token.partKey} box ${token.boxKey || order}`
          : `Box ${token.boxKey || order}`,
        acceptedAnswer: "",
        marks: 1,
        order,
      });
    }
  }

  return markers;
}

export async function detectInputBoxMarkersFromPage(
  page: import("pdfjs-dist").PDFPageProxy,
  options?: { minTopPct?: number; maxTopPct?: number },
): Promise<DetectedInputMarker[]> {
  const pdfjs = await import("pdfjs-dist");
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const spans: PdfTextSpan[] = [];

  for (const raw of content.items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const item = raw as { str: string; transform: number[]; width?: number };
    const str = item.str ?? "";
    if (!str.trim() && !/\[\[INPUT/i.test(str)) continue;

    const tm = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontSize = Math.hypot(tm[2] ?? 0, tm[3] ?? 0) || 12;
    const left = tm[4] ?? 0;
    const top = (tm[5] ?? 0) - fontSize;
    const width = (item.width ?? str.length * 0.5) * fontSize;

    spans.push({
      str,
      leftPct: (left / viewport.width) * 100,
      topPct: (top / viewport.height) * 100,
      widthPct: Math.min(40, (width / viewport.width) * 100),
      fontSizePx: fontSize,
    });
  }

  return detectInputBoxMarkersFromSpans(spans, options);
}

/** Match detected positions with metadata answers (box_N_answer, part_a_box_1_answer, …). */
export function mergeInputBoxPlacements(
  metadata: DiagramLabelPart[],
  detected: DetectedInputMarker[],
): DiagramLabelPart[] {
  if (!detected.length) {
    return metadata;
  }
  if (!metadata.length) {
    return detected.map(({ partKey: _p, order: _o, ...box }) => box);
  }

  const metaByKey = new Map(metadata.map((m) => [m.key?.trim() || "", m]));

  return detected.map((d, i) => {
    const meta =
      metaByKey.get(d.key) ??
      metaByKey.get(String(i + 1)) ??
      metadata[i];
    return {
      ...d,
      key: d.key || meta?.key || String(i + 1),
      label: meta?.label?.trim() || d.label,
      acceptedAnswer: meta?.acceptedAnswer?.trim() || d.acceptedAnswer || "",
      marks: meta?.marks ?? d.marks ?? 1,
      placeholder: meta?.placeholder ?? d.placeholder,
    };
  });
}

/** Reposition overlays after the user crops the source page image. */
export function transformOverlaysForCrop(
  overlays: DiagramLabelPart[],
  crop: CropRect,
): DiagramLabelPart[] {
  if (!isMeaningfulCropRect(crop)) return overlays;

  return overlays
    .map((overlay) => {
      if (!partHasOverlay(overlay)) return overlay;
      const x = overlay.overlayX / 100;
      const y = overlay.overlayY / 100;
      const w = overlay.overlayW / 100;
      const h = overlay.overlayH / 100;

      const next = clampOverlay({
        overlayX: ((x - crop.x) / crop.w) * 100,
        overlayY: ((y - crop.y) / crop.h) * 100,
        overlayW: (w / crop.w) * 100,
        overlayH: (h / crop.h) * 100,
      });

      if (next.overlayX + next.overlayW < 0 || next.overlayY + next.overlayH < 0) {
        return null;
      }
      if (next.overlayX > 100 || next.overlayY > 100) return null;

      return { ...overlay, ...next };
    })
    .filter((o): o is DiagramLabelPart => o != null);
}

export function groupDetectedMarkersByPart(
  detected: DetectedInputMarker[],
): { question: DetectedInputMarker[]; byPart: Map<string, DetectedInputMarker[]> } {
  const question: DetectedInputMarker[] = [];
  const byPart = new Map<string, DetectedInputMarker[]>();

  for (const marker of detected) {
    if (marker.partKey) {
      const list = byPart.get(marker.partKey) ?? [];
      list.push(marker);
      byPart.set(marker.partKey, list);
    } else {
      question.push(marker);
    }
  }

  return { question, byPart };
}
