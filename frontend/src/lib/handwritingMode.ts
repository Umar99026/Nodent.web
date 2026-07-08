import { STORAGE_KEYS } from "@/lib/constants";

export function isHandwritingValue(value: string): boolean {
  return value.trim().startsWith("data:image/");
}

/** Lightweight marker so submit enables before JPEG export finishes. */
export const HANDWRITING_INK_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Handwriting exports must not appear as text in typed answer fields. */
export function typedAnswerDisplay(value: string): string {
  return isHandwritingValue(value) ? "" : value;
}

export function collectHandwritingImages(
  answer: string,
  parts: string[],
  isMultipart: boolean,
): string[] {
  if (isMultipart) return parts.filter((part) => isHandwritingValue(part));
  return isHandwritingValue(answer) ? [answer] : [];
}

export function usesHandwritingMarking(
  subjectId: string | undefined,
  answer: string,
  parts: string[],
  isMultipart: boolean,
  _openAiEligible = false,
): boolean {
  void subjectId;
  void _openAiEligible;
  return collectHandwritingImages(answer, parts, isMultipart).length > 0;
}

export function handwritingResponseSummary(imageCount: number): string {
  return `[handwritten answer — ${imageCount} image(s)]`;
}

export function hasAnswerContent(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isHandwritingValue(trimmed)) return true;
  return trimmed.length > 0;
}

type UiPrefs = {
  handwritingMode?: boolean;
};

export function readHandwritingMode(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.uiPrefs);
    if (!raw) return false;
    const prefs = JSON.parse(raw) as UiPrefs;
    return Boolean(prefs.handwritingMode);
  } catch {
    return false;
  }
}

export function writeHandwritingMode(enabled: boolean): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.uiPrefs);
    const prefs: UiPrefs = raw ? (JSON.parse(raw) as UiPrefs) : {};
    prefs.handwritingMode = enabled;
    localStorage.setItem(STORAGE_KEYS.uiPrefs, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/** Draw / handwriting pad is available on all practice subjects. */
export function handwritingAllowedForSubject(subjectId: string | undefined): boolean {
  void subjectId;
  return true;
}

export function isDemoMathsSubject(subjectId: string | undefined): boolean {
  return String(subjectId ?? "").trim().toLowerCase() === "demo";
}
