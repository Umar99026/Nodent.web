import type { McqQuestion as McqQuestionType } from "@/lib/subjects";
import type {
  McqOptionLetter,
  McqOptionOverlays,
  PracticeExamMcqItem,
} from "@/lib/practiceExamTypes";
import { MCQ_OPTION_LETTERS } from "@/lib/practiceExamTypes";
import { buildMcqRows, normalizeMcqLetter } from "@/lib/practiceExamImport";
import type { OverlayRect } from "@/lib/diagramLabels";

export function mcqItemHasText(item: PracticeExamMcqItem): boolean {
  const hasOptions =
    item.options?.length === 4 && item.options.every((o) => o.trim());
  return Boolean(item.question?.trim() && hasOptions && item.acceptedAnswer?.trim());
}

export function mcqItemHasCrop(item: PracticeExamMcqItem): boolean {
  return Boolean(item.stimulusImageUrl?.trim());
}

/** Parsed MCQ text from TSV (crop optional). */
export function mcqItemHasContent(item: PracticeExamMcqItem): boolean {
  return mcqItemHasText(item);
}

export function practiceExamMcqToQuestion(item: PracticeExamMcqItem): McqQuestionType {
  const options =
    item.options?.length === 4
      ? item.options.map((o) => o.trim())
      : ["", "", "", ""];
  const letter = normalizeMcqLetter(item.acceptedAnswer);
  const letterIdx = MCQ_OPTION_LETTERS.indexOf(letter as McqOptionLetter);
  const answer = letterIdx >= 0 ? options[letterIdx]! : letter;

  const imageUrls: string[] = [];
  if (item.stimulusImageUrl?.trim() && item.showStimulus !== false) {
    imageUrls.push(item.stimulusImageUrl);
  }

  return {
    type: "mcq",
    topic: "Practice exam",
    question: item.question?.trim() || `Question ${item.questionNumber}`,
    options,
    answer,
    marks: item.marks ?? 1,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    id: item.questionNumber,
  };
}

/** Default tap target for separated / auto-detected letter placement. */
export const MCQ_BUTTON_SIZE_PCT = 1.2;
/** Min / max for per-question button size slider (% of page). */
export const MCQ_BUTTON_SIZE_MIN_PCT = 0.6;
export const MCQ_BUTTON_SIZE_SLIDER_MAX_PCT = 6;
/** Max button size when laid out inside a resizable group box. */
export const MCQ_BUTTON_MAX_IN_GROUP_PCT = 10;

export type McqGroupLayout = "row" | "column";

/** Minimum gap (% page) when the box is too tight for the chosen button size. */
const MCQ_BUTTON_MIN_GAP_PCT = 0.08;

function resolvePreferredButtonSize(preferredPct?: number): number {
  if (preferredPct != null && Number.isFinite(preferredPct)) {
    return Math.min(
      Math.max(preferredPct, MCQ_BUTTON_SIZE_MIN_PCT),
      MCQ_BUTTON_MAX_IN_GROUP_PCT,
    );
  }
  return MCQ_BUTTON_SIZE_PCT;
}

/** Shrink buttons only when the box cannot fit four at the preferred size. */
function fitButtonSizeInBox(
  preferred: number,
  w: number,
  h: number,
  layout: McqGroupLayout,
): number {
  const slots = 4;
  const minGaps = 3 * MCQ_BUTTON_MIN_GAP_PCT;
  const maxFromBox =
    layout === "column" ? (h - minGaps) / slots : (w - minGaps) / slots;
  if (!Number.isFinite(maxFromBox) || maxFromBox <= 0) return 0.12;
  return Math.max(0.12, Math.min(preferred, maxFromBox));
}

/**
 * Box width/height sets spacing between buttons; preferredButtonSizePct sets button diameter.
 */
function layoutMcqButtonsInBox(
  left: number,
  top: number,
  w: number,
  h: number,
  layout: McqGroupLayout,
  preferredButtonSizePct?: number,
): McqOptionOverlays {
  const cx = left + w / 2;
  const cy = top + h / 2;
  const preferred = resolvePreferredButtonSize(preferredButtonSizePct);
  const size = fitButtonSizeInBox(preferred, w, h, layout);
  const out: McqOptionOverlays = {};

  if (layout === "column") {
    const gap = Math.max(0, (h - 4 * size) / 3);
    const totalH = 4 * size + 3 * gap;
    const startCy = top + (h - totalH) / 2 + size / 2;
    for (let i = 0; i < MCQ_OPTION_LETTERS.length; i++) {
      const letter = MCQ_OPTION_LETTERS[i]!;
      out[letter] = mcqButtonRectAtCenter(
        cx,
        startCy + i * (size + gap),
        size,
      );
    }
    return out;
  }

  const gap = Math.max(0, (w - 4 * size) / 3);
  const totalW = 4 * size + 3 * gap;
  const startCx = left + (w - totalW) / 2 + size / 2;
  for (let i = 0; i < MCQ_OPTION_LETTERS.length; i++) {
    const letter = MCQ_OPTION_LETTERS[i]!;
    out[letter] = mcqButtonRectAtCenter(
      startCx + i * (size + gap),
      cy,
      size,
    );
  }
  return out;
}

/** MCQ group bounds — allow small boxes (unlike written answer slots). */
export function clampMcqGroupBounds(rect: OverlayRect): OverlayRect {
  const w = Math.min(Math.max(rect.overlayW, 0.6), 95);
  const h = Math.min(Math.max(rect.overlayH, 0.6), 95);
  const x = Math.min(Math.max(rect.overlayX, 0), 100 - w);
  const y = Math.min(Math.max(rect.overlayY, 0), 100 - h);
  return { overlayX: x, overlayY: y, overlayW: w, overlayH: h };
}

/** Single MCQ button — never use written-slot clampOverlay (3% minimum). */
export function clampMcqButtonRect(
  rect: OverlayRect,
  maxSize = MCQ_BUTTON_MAX_IN_GROUP_PCT,
): OverlayRect {
  const size = Math.min(
    Math.max(Math.max(rect.overlayW, rect.overlayH), 0.1),
    maxSize,
  );
  const cx = rect.overlayX + rect.overlayW / 2;
  const cy = rect.overlayY + rect.overlayH / 2;
  let x = cx - size / 2;
  let y = cy - size / 2;
  x = Math.min(Math.max(x, 0), 100 - size);
  y = Math.min(Math.max(y, 0), 100 - size);
  return { overlayX: x, overlayY: y, overlayW: size, overlayH: size };
}

export function getMcqButtonSizePct(item: PracticeExamMcqItem): number {
  const n = item.mcqButtonSizePct;
  if (n != null && Number.isFinite(n)) {
    return Math.min(
      Math.max(n, MCQ_BUTTON_SIZE_MIN_PCT),
      MCQ_BUTTON_MAX_IN_GROUP_PCT,
    );
  }
  return MCQ_BUTTON_SIZE_PCT;
}

export function mcqButtonRectAtCenter(
  centerX: number,
  centerY: number,
  size = MCQ_BUTTON_SIZE_PCT,
): OverlayRect {
  return clampMcqButtonRect(
    {
      overlayX: centerX - size / 2,
      overlayY: centerY - size / 2,
      overlayW: size,
      overlayH: size,
    },
    Math.max(size, MCQ_BUTTON_SIZE_PCT),
  );
}

export function finalizeMcqButtonPlacement(rect: OverlayRect): OverlayRect {
  return clampMcqButtonRect(rect, MCQ_BUTTON_SIZE_PCT);
}

export function mcqButtonDisplayRect(rect: OverlayRect): OverlayRect {
  return clampMcqButtonRect(rect, MCQ_BUTTON_MAX_IN_GROUP_PCT);
}

export function boundsFromMcqOverlays(overlays?: McqOptionOverlays): OverlayRect | null {
  const rects = MCQ_OPTION_LETTERS.map((letter) => overlays?.[letter]).filter(
    Boolean,
  ) as OverlayRect[];
  if (!rects.length) return null;
  const pad = MCQ_BUTTON_SIZE_PCT * 0.25;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const rect of rects) {
    const display = mcqButtonDisplayRect(rect);
    minX = Math.min(minX, display.overlayX);
    minY = Math.min(minY, display.overlayY);
    maxX = Math.max(maxX, display.overlayX + display.overlayW);
    maxY = Math.max(maxY, display.overlayY + display.overlayH);
  }
  return clampMcqGroupBounds({
    overlayX: minX - pad,
    overlayY: minY - pad,
    overlayW: maxX - minX + pad * 2,
    overlayH: maxY - minY + pad * 2,
  });
}

export function getMcqGroupBounds(item: PracticeExamMcqItem): OverlayRect | null {
  if (item.mcqGroupBounds) return clampMcqGroupBounds(item.mcqGroupBounds);
  return boundsFromMcqOverlays(item.optionOverlays);
}

/** Pick row (A–D in a line) vs column (stacked) from the placement box shape. */
export function inferMcqGroupLayout(bounds: OverlayRect): McqGroupLayout {
  const b = clampMcqGroupBounds(bounds);
  return b.overlayH > b.overlayW * 1.08 ? "column" : "row";
}

export function layoutMcqGroupInBounds(
  bounds: OverlayRect,
  layout: McqGroupLayout = inferMcqGroupLayout(bounds),
  preferredButtonSizePct?: number,
): McqOptionOverlays {
  const b = clampMcqGroupBounds(bounds);
  return layoutMcqButtonsInBox(
    b.overlayX,
    b.overlayY,
    b.overlayW,
    b.overlayH,
    layout,
    preferredButtonSizePct,
  );
}

export function mcqBoundsFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): OverlayRect {
  return clampMcqGroupBounds({
    overlayX: Math.min(a.x, b.x),
    overlayY: Math.min(a.y, b.y),
    overlayW: Math.abs(b.x - a.x),
    overlayH: Math.abs(b.y - a.y),
  });
}

export function translateMcqOverlays(
  overlays: McqOptionOverlays | undefined,
  dx: number,
  dy: number,
): McqOptionOverlays {
  const out: McqOptionOverlays = { ...(overlays ?? {}) };
  for (const letter of MCQ_OPTION_LETTERS) {
    const rect = out[letter];
    if (!rect) continue;
    const cx = rect.overlayX + rect.overlayW / 2 + dx;
    const cy = rect.overlayY + rect.overlayH / 2 + dy;
    const size = Math.max(rect.overlayW, rect.overlayH);
    out[letter] = mcqButtonRectAtCenter(cx, cy, size);
  }
  return out;
}

export function mcqOverlayOrigins(item: PracticeExamMcqItem): McqOptionOverlays {
  const out: McqOptionOverlays = {};
  for (const letter of MCQ_OPTION_LETTERS) {
    const rect = item.optionOverlays?.[letter];
    if (rect) out[letter] = clampMcqButtonRect(rect, MCQ_BUTTON_MAX_IN_GROUP_PCT);
  }
  return out;
}

export function mcqPlacementCount(item: PracticeExamMcqItem): number {
  return MCQ_OPTION_LETTERS.filter((letter) => item.optionOverlays?.[letter]).length;
}

export function mcqItemReadingSortKey(item: PracticeExamMcqItem): number {
  const page = item.pageNumber ?? 9999;
  let minY = 999;
  let minX = 999;
  for (const letter of MCQ_OPTION_LETTERS) {
    const rect = item.optionOverlays?.[letter];
    if (!rect) continue;
    minY = Math.min(minY, rect.overlayY);
    minX = Math.min(minX, rect.overlayX);
  }
  return page * 1_000_000 + minY * 1_000 + minX;
}

/**
 * Ensure Q1…Qn rows exist and reflow button layout from stored bounds (no renumbering).
 */
export function normalizeMcqItems(
  mcqCount: number,
  items: PracticeExamMcqItem[],
): PracticeExamMcqItem[] {
  return buildMcqRows(mcqCount, items).map((item) =>
    mcqPlacementCount(item) > 0 ? reflowMcqItemPlacements(item) : item,
  );
}

/**
 * @deprecated Do not renumber placements — use normalizeMcqItems. Kept for one-off migration scripts.
 */
export function reassignMcqPlacementsByReadingOrder(
  mcqCount: number,
  items: PracticeExamMcqItem[],
): PracticeExamMcqItem[] {
  if (mcqCount < 1) return items;

  const rows: PracticeExamMcqItem[] = [];
  const byQuestion = new Map<number, PracticeExamMcqItem>();
  for (const item of items) {
    const qn = item.questionNumber;
    if (!Number.isFinite(qn) || qn < 1 || qn > mcqCount) continue;
    if (!byQuestion.has(qn)) byQuestion.set(qn, item);
  }
  for (let q = 1; q <= mcqCount; q++) {
    rows.push(
      byQuestion.get(q) ?? {
        id: `mcq-q${q}`,
        questionNumber: q,
        acceptedAnswer: "",
        marks: 1,
      },
    );
  }

  const placements = rows
    .filter((item) => mcqPlacementCount(item) > 0)
    .sort((a, b) => mcqItemReadingSortKey(a) - mcqItemReadingSortKey(b))
    .map((item) => ({
      pageNumber: item.pageNumber,
      optionOverlays: item.optionOverlays,
      mcqGroupBounds: item.mcqGroupBounds,
      mcqButtonsSeparated: item.mcqButtonsSeparated,
      mcqGroupLayout: item.mcqGroupLayout,
    }));

  const cleared: PracticeExamMcqItem[] = rows.map((item) => ({
    ...item,
    pageNumber: undefined,
    optionOverlays: {},
    mcqGroupBounds: undefined,
  }));

  for (let i = 0; i < placements.length; i++) {
    const slot = placements[i]!;
    const row = cleared[i];
    if (!row) break;
    cleared[i] = reflowMcqItemPlacements({
      ...row,
      pageNumber: slot.pageNumber,
      optionOverlays: { ...(slot.optionOverlays ?? {}) },
      mcqGroupBounds: slot.mcqGroupBounds,
      mcqButtonsSeparated: slot.mcqButtonsSeparated,
      mcqGroupLayout: slot.mcqGroupLayout,
    });
  }

  return cleared;
}

export function reflowMcqItemPlacements(item: PracticeExamMcqItem): PracticeExamMcqItem {
  if (mcqPlacementCount(item) === 0) return item;

  const buttonSize = getMcqButtonSizePct(item);

  if (item.mcqButtonsSeparated) {
    const optionOverlays: McqOptionOverlays = {};
    for (const letter of MCQ_OPTION_LETTERS) {
      const rect = item.optionOverlays?.[letter];
      if (!rect) continue;
      const cx = rect.overlayX + rect.overlayW / 2;
      const cy = rect.overlayY + rect.overlayH / 2;
      optionOverlays[letter] = mcqButtonRectAtCenter(cx, cy, buttonSize);
    }
    return {
      ...item,
      optionOverlays,
      mcqGroupBounds: boundsFromMcqOverlays(optionOverlays) ?? item.mcqGroupBounds,
    };
  }

  const bounds = item.mcqGroupBounds ?? boundsFromMcqOverlays(item.optionOverlays);
  if (!bounds) {
    const optionOverlays: McqOptionOverlays = {};
    for (const letter of MCQ_OPTION_LETTERS) {
      const rect = item.optionOverlays?.[letter];
      if (rect) optionOverlays[letter] = clampMcqButtonRect(rect, MCQ_BUTTON_SIZE_PCT);
    }
    return { ...item, optionOverlays };
  }

  const layout = item.mcqGroupLayout ?? inferMcqGroupLayout(bounds);
  const b = clampMcqGroupBounds(bounds);
  return {
    ...item,
    optionOverlays: layoutMcqGroupInBounds(b, layout, buttonSize),
    mcqGroupBounds: b,
    mcqGroupLayout: layout,
  };
}

export function isMcqFullyPlaced(item: PracticeExamMcqItem): boolean {
  return mcqPlacementCount(item) === 4 && !!item.pageNumber && item.pageNumber > 0;
}

export function sortMcqItemsByQuestion(
  items: PracticeExamMcqItem[],
): PracticeExamMcqItem[] {
  return [...items].sort((a, b) => a.questionNumber - b.questionNumber);
}

export function firstMissingMcqLetter(
  item: PracticeExamMcqItem,
): McqOptionLetter | null {
  for (const letter of MCQ_OPTION_LETTERS) {
    if (!item.optionOverlays?.[letter]) return letter;
  }
  return null;
}

export function mcqItemsOnPage(
  items: PracticeExamMcqItem[],
  pageNumber: number,
): PracticeExamMcqItem[] {
  return sortMcqItemsByQuestion(
    items.filter(
      (item) => item.pageNumber === pageNumber && mcqPlacementCount(item) > 0,
    ),
  );
}

export function isMcqAnswerCorrect(
  item: PracticeExamMcqItem,
  studentLetter: string,
): boolean {
  return (
    normalizeMcqLetter(studentLetter) === normalizeMcqLetter(item.acceptedAnswer)
  );
}

export type McqOverlayRef = {
  itemId: string;
  letter: McqOptionLetter;
};

export function flattenMcqOverlays(
  items: PracticeExamMcqItem[],
): Array<McqOverlayRef & { rect: NonNullable<PracticeExamMcqItem["optionOverlays"]>[McqOptionLetter] }> {
  const out: Array<
    McqOverlayRef & {
      rect: NonNullable<PracticeExamMcqItem["optionOverlays"]>[McqOptionLetter];
    }
  > = [];
  for (const item of sortMcqItemsByQuestion(items)) {
    for (const letter of MCQ_OPTION_LETTERS) {
      const rect = item.optionOverlays?.[letter];
      if (rect) out.push({ itemId: item.id, letter, rect });
    }
  }
  return out;
}

const NEXT_MCQ_LETTER: Record<McqOptionLetter, McqOptionLetter | null> = {
  A: "B",
  B: "C",
  C: "D",
  D: null,
};

export function nextMcqPlacementLetter(letter: McqOptionLetter): McqOptionLetter | null {
  return NEXT_MCQ_LETTER[letter];
}
