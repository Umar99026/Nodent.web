import type { MultipartPartDraft } from "@/components/admin/MultipartAnswerPartsEditor";
import {
  clampOverlay,
  DEFAULT_OVERLAY,
  overlayToPayload,
  partHasOverlay,
  type DiagramLabelPart,
  type OverlayRect,
} from "@/lib/diagramLabels";import { studentFacingPartText } from "@/lib/questionDisplay";

export type AnswerSlotSource = {
  key: string;
  descriptor: string;
  acceptedAnswer: string;
  marks: number;
  placeholder?: string;
  transparentInput?: boolean;
  /** MCQ stem for practice exams (TSV label / stem column). */
  questionStem?: string;
  /** MCQ option texts when importing exam solutions. */
  mcqOptions?: string[];
};

export function overlayPartKey(overlay: DiagramLabelPart): string {
  return (overlay.sourcePartKey ?? overlay.key ?? "").trim().toLowerCase();
}

export function placedPartKeys(overlays: DiagramLabelPart[]): Set<string> {
  const keys = new Set<string>();
  for (const overlay of overlays) {
    if (!partHasOverlay(overlay)) continue;
    const key = overlayPartKey(overlay);
    if (key) keys.add(key);
  }
  return keys;
}

export function answerSlotFromPartLike(part: {
  label: string;
  descriptor?: string;
  acceptedAnswer?: string;
  marks?: number;
  placeholder?: string;
}): AnswerSlotSource | null {
  const key = part.label?.trim().toLowerCase();
  if (!key) return null;
  const descriptor = part.descriptor?.trim() || "";
  const acceptedAnswer = part.acceptedAnswer?.trim() || "";
  if (!descriptor && !acceptedAnswer) return null;
  return {
    key,
    descriptor: studentFacingPartText(descriptor) || descriptor || key,
    acceptedAnswer,
    marks: Math.max(1, Math.round(part.marks ?? 1)),
    placeholder: part.placeholder?.trim() || undefined,
  };
}

export function unplacedAnswerSlots(
  parts: Array<{
    label: string;
    descriptor?: string;
    acceptedAnswer?: string;
    marks?: number;
    placeholder?: string;
  }>,
  placed: DiagramLabelPart[],
): AnswerSlotSource[] {
  const used = placedPartKeys(placed);
  const slots: AnswerSlotSource[] = [];
  for (const part of parts) {
    const slot = answerSlotFromPartLike(part);
    if (!slot || used.has(slot.key)) continue;
    slots.push(slot);
  }
  return slots;
}

export function overlayFromAnswerSlot(
  slot: AnswerSlotSource,
  rect: OverlayRect,
): DiagramLabelPart {
  return {
    ...clampOverlay(rect),
    key: slot.key,
    sourcePartKey: slot.key,
    label: slot.descriptor,
    acceptedAnswer: slot.acceptedAnswer,
    marks: slot.marks,
    placeholder: slot.placeholder ?? "",
    transparentInput: slot.transparentInput,
  };
}

export function placeSlotAtPoint(
  slot: AnswerSlotSource,
  xPct: number,
  yPct: number,
): DiagramLabelPart {
  const w = DEFAULT_OVERLAY.overlayW;
  const h = DEFAULT_OVERLAY.overlayH;
  return overlayFromAnswerSlot(slot, {
    overlayX: Math.min(Math.max(xPct - w / 2, 0), 100 - w),
    overlayY: Math.min(Math.max(yPct - h / 2, 0), 100 - h),
    overlayW: w,
    overlayH: h,
  });
}
export function removePlacedSlot(
  placed: DiagramLabelPart[],
  partKey: string,
): DiagramLabelPart[] {
  const key = partKey.trim().toLowerCase();
  return placed.filter((overlay) => overlayPartKey(overlay) !== key);
}

/** Stimulus overlay parts for import — one per placed slot, answers from part definitions. */
export function buildStimulusPartsFromPlacedSlots(
  parts: Array<{
    label: string;
    descriptor?: string;
    acceptedAnswer?: string;
    marks?: number;
    placeholder?: string;
  }>,
  placed: DiagramLabelPart[],
): MultipartPartDraft[] {
  return placed
    .filter(partHasOverlay)
    .map((overlay, index) => {
      const key = overlayPartKey(overlay) || overlay.key?.trim() || String(index + 1);
      const part = parts.find((p) => p.label?.trim().toLowerCase() === key);
      const slot = part ? answerSlotFromPartLike(part) : null;
      const payload = overlayToPayload(overlay);
      const slotImage = overlay.slotImageUrl?.trim();
      return {
        key,
        label: slot?.descriptor || overlay.label?.trim() || key,
        placeholder: overlay.placeholder?.trim() || slot?.placeholder || "",
        marks: overlay.marks ?? slot?.marks ?? 1,
        acceptedAnswer:
          overlay.acceptedAnswer?.trim() || slot?.acceptedAnswer || part?.acceptedAnswer?.trim() || "",
        ...(slotImage ? { imageUrl: slotImage } : {}),
        ...(payload ?? {}),
      };
    });
}

export function placedOverlayForSlot(
  placed: DiagramLabelPart[],
  partKey: string,
): DiagramLabelPart | undefined {
  const key = partKey.trim().toLowerCase();
  return placed.find((overlay) => partHasOverlay(overlay) && overlayPartKey(overlay) === key);
}
