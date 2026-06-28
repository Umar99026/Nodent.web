/** Ruled line height (px) for full-width exam answer blocks. */
export const EXAM_BLOCK_LINE_HEIGHT = 32;

/** Ruled line height (px) for PDF overlay input boxes. */
export const EXAM_OVERLAY_LINE_HEIGHT = 24;

const DEFAULT_MAX_LINES = 40;

/**
 * One spare ruled line below content — when the user fills it, another spawns.
 */
export function examPaperVisibleLines(
  value: string,
  minLines: number,
  maxLines = DEFAULT_MAX_LINES,
): number {
  const contentLines = value.split("\n").length;
  return Math.min(maxLines, Math.max(minLines, contentLines + 1));
}

export function overlayMinLinesFromHeight(
  overlayHPercent: number,
  containerHeightPx: number,
  lineHeightPx = EXAM_OVERLAY_LINE_HEIGHT,
): number {
  if (!Number.isFinite(containerHeightPx) || containerHeightPx <= 0) return 2;
  const boxHeightPx = (overlayHPercent / 100) * containerHeightPx;
  return Math.max(2, Math.round(boxHeightPx / lineHeightPx));
}
