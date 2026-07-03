import { STORAGE_KEYS } from "@/lib/constants";

export function isHandwritingValue(value: string): boolean {
  return value.trim().startsWith("data:image/");
}

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
  openAiEligible = false,
): boolean {
  void subjectId;
  void openAiEligible;
  // Handwriting (canvas) answers are no longer interpreted with AI.
  // If iPad Scribble converts handwriting to text, it will be graded as normal text.
  // Canvas-only drawings are stored for review but are not auto-read for marking.
  return false;
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

/** Handwriting / draw answers are only enabled in the demo subject sandbox. */
export function handwritingAllowedForSubject(subjectId: string | undefined): boolean {
  // Allow handwriting mode UI across all subjects.
  // Note: marking remains text-first (no AI interpretation of drawings).
  void subjectId;
  return true;
}
