/** Percentage position/size (0–100) relative to the diagram image. */
import { splitAnswerValueAndUnit } from "@/lib/utils";

export type OverlayRect = {
  overlayX: number;
  overlayY: number;
  overlayW: number;
  overlayH: number;
};

export type DiagramLabelPart = OverlayRect & {
  key: string;
  label?: string;
  placeholder?: string;
  marks?: number;
  acceptedAnswer?: string;
  transparentInput?: boolean;
};

/** Horizontal inline answer boxes for a subquestion (not placed on an image). */
export type InlineInputBox = {
  key: string;
  label?: string;
  placeholder?: string;
  marks?: number;
  acceptedAnswer?: string;
  /** Display suffix/prefix on the student input (e.g. kg, $, %). */
  unit?: string;
};

export function createInlineInputBox(index: number): InlineInputBox {
  const n = index + 1;
  return {
    key: String.fromCharCode(97 + index),
    label: String(n),
    placeholder: "",
    marks: 1,
    acceptedAnswer: "",
  };
}

export function legacyOverlaysToInlineInputs(
  overlays?: DiagramLabelPart[] | null,
): InlineInputBox[] | undefined {
  if (!overlays?.length) return undefined;
  return overlays.map((overlay, index) => {
    const raw = overlay.acceptedAnswer?.trim() || "";
    const explicitUnit = (overlay as { unit?: string }).unit?.trim();
    const { value, unit } = splitAnswerValueAndUnit(raw);
    return {
      key: overlay.key?.trim() || String(index + 1),
      label: overlay.label?.trim() || String(index + 1),
      placeholder: overlay.placeholder?.trim() || "",
      marks: overlay.marks ?? 1,
      acceptedAnswer: value,
      ...(explicitUnit || unit ? { unit: explicitUnit || unit } : {}),
    };
  });
}

function stripOverlayCoords<T extends Record<string, unknown>>(part: T): T {
  const next = { ...part };
  delete next.overlayX;
  delete next.overlayY;
  delete next.overlayW;
  delete next.overlayH;
  return next;
}

function overlayPartToInlineBox(
  part: PartFigureLabelSource & {
    overlayX?: number;
    key?: string;
    label?: string;
    placeholder?: string;
    marks?: number;
    acceptedAnswer?: string;
    unit?: string;
  },
  index: number,
): InlineInputBox {
  const raw = part.acceptedAnswer?.trim() || "";
  const explicitUnit = part.unit?.trim();
  const { value, unit } = splitAnswerValueAndUnit(raw);
  return {
    key: part.key?.trim() || String(index + 1),
    label: part.label?.trim() || String(index + 1),
    placeholder: part.placeholder?.trim() || "",
    marks: part.marks ?? 1,
    acceptedAnswer: value,
    ...(explicitUnit || unit ? { unit: explicitUnit || unit } : {}),
  };
}

/** Legacy imports stored each box as a stimulus overlay part — fold into horizontal inline boxes. */
export function coalesceAnswerPartsForInlineInputs<
  T extends PartFigureLabelSource & { overlayX?: number; imageUrl?: string; key?: string; label?: string },
>(parts: T[]): T[] {
  if (!parts.length) return parts;

  let working = parts;

  if (working.length >= 2) {
    const rawStimulusSlots = working.filter(
      (p) => isStimulusOverlayPart(p) && !p.inlineInputs?.length,
    );
    const rawTextParts = working.filter(
      (p) => !isStimulusOverlayPart(p) || p.inlineInputs?.length,
    );
    if (rawStimulusSlots.length >= 2 && rawTextParts.length === 0) {
      const inlineInputs: InlineInputBox[] = rawStimulusSlots.map((slot, index) =>
        overlayPartToInlineBox(slot, index),
      );
      working = [
        {
          ...rawStimulusSlots[0]!,
          key: "a",
          label: rawStimulusSlots[0]!.label?.trim() || "Answer",
          inlineInputs,
          labelOverlays: undefined,
          overlayX: undefined,
          overlayY: undefined,
          overlayW: undefined,
          overlayH: undefined,
        },
      ] as T[];
    }
  }

  const hydrated = working.map((part, index) => {
    if (part.inlineInputs?.length) return stripOverlayCoords(part);
    const inline = legacyOverlaysToInlineInputs(part.labelOverlays);
    if (inline?.length) {
      return {
        ...stripOverlayCoords(part),
        inlineInputs: inline,
        labelOverlays: undefined,
      };
    }
    if (isStimulusOverlayPart(part)) {
      return {
        ...stripOverlayCoords(part),
        inlineInputs: [overlayPartToInlineBox(part, index)],
      };
    }
    return part;
  });

  if (hydrated.length < 2) return hydrated;

  const singleBoxInlineParts = hydrated.filter((p) => {
    const inline = inlineInputsForPart(p);
    return inline.length === 1 && !p.imageUrl?.trim();
  });
  const otherParts = hydrated.filter((p) => !singleBoxInlineParts.includes(p));
  if (singleBoxInlineParts.length >= 2 && otherParts.length === 0) {
    const inlineInputs = singleBoxInlineParts.flatMap((p) => inlineInputsForPart(p));
    return [
      {
        ...singleBoxInlineParts[0]!,
        key: "a",
        label: singleBoxInlineParts[0]!.label?.trim() || "Answer",
        inlineInputs,
        labelOverlays: undefined,
      },
    ] as T[];
  }

  return hydrated;
}

export const DEFAULT_OVERLAY: OverlayRect = {
  overlayX: 6,
  overlayY: 10,
  overlayW: 88,
  overlayH: 8,
};

export function clampOverlay(rect: OverlayRect): OverlayRect {
  const w = Math.min(Math.max(rect.overlayW, 3), 95);
  const h = Math.min(Math.max(rect.overlayH, 3), 95);
  const x = Math.min(Math.max(rect.overlayX, 0), 100 - w);
  const y = Math.min(Math.max(rect.overlayY, 0), 100 - h);
  return { overlayX: x, overlayY: y, overlayW: w, overlayH: h };
}

export function overlayRectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): OverlayRect {
  const overlayX = Math.min(a.x, b.x);
  const overlayY = Math.min(a.y, b.y);
  const overlayW = Math.abs(b.x - a.x);
  const overlayH = Math.abs(b.y - a.y);
  return clampOverlay({ overlayX, overlayY, overlayW, overlayH });
}

/** Exam PDF overlays — keep the drawn size (no snap to full-width default). */
export function finalizePreciseOverlay(rect: OverlayRect): OverlayRect {
  if (!isMeaningfulOverlay(rect)) {
    const cx = rect.overlayX + rect.overlayW / 2;
    const cy = rect.overlayY + rect.overlayH / 2;
    return clampOverlay({
      overlayX: cx - 12,
      overlayY: cy - 2.5,
      overlayW: 24,
      overlayH: 5,
    });
  }
  return clampOverlay(rect);
}

/** Wide exam-style box — spans most of the page tile; tiny drags snap to default size. */
export function finalizeDrawnOverlay(rect: OverlayRect): OverlayRect {
  const targetAspect = DEFAULT_OVERLAY.overlayW / DEFAULT_OVERLAY.overlayH;

  if (!isMeaningfulOverlay(rect)) {
    const cx = rect.overlayX + rect.overlayW / 2;
    const cy = rect.overlayY + rect.overlayH / 2;
    return clampOverlay({
      overlayX: cx - DEFAULT_OVERLAY.overlayW / 2,
      overlayY: cy - DEFAULT_OVERLAY.overlayH / 2,
      overlayW: DEFAULT_OVERLAY.overlayW,
      overlayH: DEFAULT_OVERLAY.overlayH,
    });
  }

  let { overlayX, overlayY, overlayW, overlayH } = clampOverlay(rect);
  const minW = DEFAULT_OVERLAY.overlayW * 0.65;
  const minH = DEFAULT_OVERLAY.overlayH * 0.55;

  if (overlayW < minW) {
    const cx = overlayX + overlayW / 2;
    overlayW = DEFAULT_OVERLAY.overlayW;
    overlayX = Math.min(Math.max(cx - overlayW / 2, 0), 100 - overlayW);
  }
  if (overlayH < minH) overlayH = DEFAULT_OVERLAY.overlayH;

  const aspect = overlayW / Math.max(overlayH, 0.1);
  if (aspect < targetAspect * 0.85) {
    overlayW = Math.min(overlayH * targetAspect, 100 - overlayX);
  }

  return clampOverlay({ overlayX, overlayY, overlayW, overlayH });
}

/** Widen overlays saved before full-width defaults (legacy narrow / square boxes). */
export function normalizeStoredOverlay(rect: OverlayRect): OverlayRect {
  const minAcceptableW = DEFAULT_OVERLAY.overlayW * 0.65;
  if (rect.overlayW >= minAcceptableW) {
    const targetAspect = DEFAULT_OVERLAY.overlayW / DEFAULT_OVERLAY.overlayH;
    const aspect = rect.overlayW / Math.max(rect.overlayH, 0.1);
    if (aspect >= targetAspect * 0.85) return clampOverlay(rect);
  }
  return finalizeDrawnOverlay(rect);
}

export type OverlayResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function resizeOverlayFromHandle(
  handle: OverlayResizeHandle,
  orig: OverlayRect,
  dx: number,
  dy: number,
): OverlayRect {
  let { overlayX: x, overlayY: y, overlayW: w, overlayH: h } = orig;

  if (handle.includes("e")) w += dx;
  if (handle.includes("w")) {
    x += dx;
    w -= dx;
  }
  if (handle.includes("s")) h += dy;
  if (handle.includes("n")) {
    y += dy;
    h -= dy;
  }

  return clampOverlay({ overlayX: x, overlayY: y, overlayW: w, overlayH: h });
}

export function isMeaningfulOverlay(rect: OverlayRect): boolean {
  return rect.overlayW >= 2 && rect.overlayH >= 2;
}

export function partHasOverlay(
  part: Partial<OverlayRect> | null | undefined,
): part is OverlayRect {
  if (!part) return false;
  return (
    typeof part.overlayX === "number" &&
    typeof part.overlayY === "number" &&
    typeof part.overlayW === "number" &&
    typeof part.overlayH === "number"
  );
}

export function readOverlayFromPart(row: Record<string, unknown>): OverlayRect | null {
  const x = Number(row.overlayX ?? row.overlay_x);
  const y = Number(row.overlayY ?? row.overlay_y);
  const w = Number(row.overlayW ?? row.overlay_w);
  const h = Number(row.overlayH ?? row.overlay_h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return null;
  return clampOverlay({ overlayX: x, overlayY: y, overlayW: w, overlayH: h });
}

export function overlayToPayload(part: Partial<DiagramLabelPart>): Record<string, number> | null {
  if (!partHasOverlay(part)) return null;
  return {
    overlayX: Math.round(part.overlayX * 10) / 10,
    overlayY: Math.round(part.overlayY * 10) / 10,
    overlayW: Math.round(part.overlayW * 10) / 10,
    overlayH: Math.round(part.overlayH * 10) / 10,
  };
}

export function isDiagramLabelQuestion(
  parts: Array<Partial<DiagramLabelPart>>,
  diagramImageUrl?: string | null,
): boolean {
  if (!diagramImageUrl?.trim()) return false;
  if (parts.some((p) => partUsesInlineInputs(p))) return false;
  const labelled = parts.filter((p) => p?.label?.trim() || partHasOverlay(p));
  if (!labelled.length) return false;
  return labelled.every((p) => partHasOverlay(p));
}

export function createOverlayPartFromRect(index: number, rect: OverlayRect): DiagramLabelPart {
  const n = index + 1;
  return {
    key: String.fromCharCode(97 + index),
    label: String(n),
    placeholder: "",
    marks: 1,
    acceptedAnswer: "",
    ...clampOverlay(rect),
  };
}

export function createOverlayPart(index: number, x: number, y: number): DiagramLabelPart {
  const n = index + 1;
  const rect = clampOverlay({
    overlayX: x - DEFAULT_OVERLAY.overlayW / 2,
    overlayY: y - DEFAULT_OVERLAY.overlayH / 2,
    overlayW: DEFAULT_OVERLAY.overlayW,
    overlayH: DEFAULT_OVERLAY.overlayH,
  });
  return {
    key: String.fromCharCode(97 + index),
    label: String(n),
    placeholder: "",
    marks: 1,
    acceptedAnswer: "",
    ...rect,
  };
}

export type PartFigureLabelSource = {
  imageUrl?: string;
  labelOverlays?: DiagramLabelPart[];
  inlineInputs?: InlineInputBox[];
  acceptedAnswer?: string;
  marks?: number;
};

export function inlineInputsForPart(
  part: PartFigureLabelSource | null | undefined,
): InlineInputBox[] {
  if (!part) return [];
  if (part.inlineInputs?.length) return part.inlineInputs;
  return legacyOverlaysToInlineInputs(part.labelOverlays) ?? [];
}

export function partUsesInlineInputs(part: PartFigureLabelSource | null | undefined): boolean {
  return inlineInputsForPart(part).length > 0;
}

export function questionUsesInlineInputs(
  parts: PartFigureLabelSource[] | null | undefined,
): boolean {
  return (parts ?? []).some((part) => partUsesInlineInputs(part));
}

/** @deprecated Legacy on-image overlays — use partUsesInlineInputs. */
export function partUsesFigureLabels(part: PartFigureLabelSource | null | undefined): boolean {
  if (partUsesInlineInputs(part)) return false;
  if (!part?.imageUrl?.trim()) return false;
  return (part.labelOverlays ?? []).some((overlay) => partHasOverlay(overlay));
}

/** Overlay slot on the main stimulus image (not a multipart figure). */
export function isStimulusOverlayPart(
  part: PartFigureLabelSource & { overlayX?: number; imageUrl?: string },
): boolean {
  if (!partHasOverlay(part)) return false;
  return !part.imageUrl?.trim();
}

export function partitionAnswerParts<T extends PartFigureLabelSource & { overlayX?: number; imageUrl?: string }>(
  parts: T[],
): { stimulusOverlays: T[]; multipartParts: T[]; multipartIndices: number[] } {
  const stimulusOverlays: T[] = [];
  const multipartParts: T[] = [];
  const multipartIndices: number[] = [];
  parts.forEach((part, index) => {
    if (isStimulusOverlayPart(part)) {
      stimulusOverlays.push(part);
    } else {
      multipartParts.push(part);
      multipartIndices.push(index);
    }
  });
  return { stimulusOverlays, multipartParts, multipartIndices };
}

export function slotsForPart(part: PartFigureLabelSource | null | undefined): number {
  const inline = inlineInputsForPart(part);
  if (inline.length) return inline.length;
  if (partUsesFigureLabels(part)) return part!.labelOverlays!.length;
  return 1;
}

export function slotIndexForPartOverlay(
  configuredParts: PartFigureLabelSource[],
  partIndex: number,
  overlayIndex: number,
): number {
  let slot = 0;
  for (let i = 0; i < partIndex; i++) {
    slot += slotsForPart(configuredParts[i]);
  }
  return slot + overlayIndex;
}

export function flattenPartAcceptedAnswers(parts: PartFigureLabelSource[]): string[] {
  return parts
    .flatMap((part) => {
      const inline = inlineInputsForPart(part);
      if (inline.length) {
        return inline.map((box) => (box.acceptedAnswer ?? "").trim());
      }
      if (partUsesFigureLabels(part)) {
        return (part.labelOverlays ?? []).map((overlay) => (overlay.acceptedAnswer ?? "").trim());
      }
      return [(part as { acceptedAnswer?: string }).acceptedAnswer?.trim() ?? ""];
    })
    .filter(Boolean);
}

/** One expected answer per input slot (multipart text fields + diagram label boxes). */
export function expectedAnswersForQuestionSlots(
  parts: PartFigureLabelSource[],
  acceptedPool: string[],
): string[] {
  const slotCount = Math.max(
    1,
    parts.reduce((sum, part) => sum + slotsForPart(part), 0),
  );
  const fromStructure = parts.flatMap((part) => {
    const inline = inlineInputsForPart(part);
    if (inline.length) {
      return inline.map((box) => String(box.acceptedAnswer ?? "").trim());
    }
    if (partUsesFigureLabels(part)) {
      return (part.labelOverlays ?? []).map((overlay) =>
        String(overlay.acceptedAnswer ?? "").trim(),
      );
    }
    return [String((part as { acceptedAnswer?: string }).acceptedAnswer ?? "").trim()];
  });
  if (fromStructure.some((answer) => answer.length > 0)) {
    while (fromStructure.length < slotCount) fromStructure.push("");
    return fromStructure.slice(0, slotCount);
  }
  if (!acceptedPool.length) return Array(slotCount).fill("");
  const normalized = acceptedPool.map((a) => String(a ?? "").trim());
  if (normalized.length >= slotCount) return normalized.slice(0, slotCount);
  return normalized;
}

/** Comma/pipe/semicolon-separated synonyms in one accepted-answer field. */
export function acceptedSynonyms(accepted: string): string[] {
  return String(accepted ?? "")
    .split(/[,|;/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function partHasFigureLabelsOnly(part: PartFigureLabelSource | null | undefined): boolean {
  return partUsesFigureLabels(part);
}

export function marksFromParts(parts: PartFigureLabelSource[]): number {
  return parts.reduce((sum, part) => {
    const inline = inlineInputsForPart(part);
    if (inline.length) {
      return sum + inline.reduce((boxSum, box) => boxSum + (box.marks ?? 1), 0);
    }
    if (partUsesFigureLabels(part)) {
      return (
        sum +
        (part.labelOverlays ?? []).reduce((overlaySum, overlay) => overlaySum + (overlay.marks ?? 1), 0)
      );
    }
    return sum + (part.marks ?? 1);
  }, 0);
}

export function pointerToPercent(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * 100;
  const y = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.min(Math.max(x, 0), 100),
    y: Math.min(Math.max(y, 0), 100),
  };
}
