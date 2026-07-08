/** Keep in sync with frontend/src/lib/wordedQuestion.ts */

const WORDED_COMMAND_RE =
  /\b(?:explain|discuss|prove|justify|describe|outline|compare|contrast|evaluate|assess|analyse|analyze|argue|demonstrate|interpret)\b/i;

const SHOW_REASON_RE = /\bshow\s+(?:that|why|how)\b/i;
const GIVE_REASONS_RE = /\bgive\s+reasons?\b/i;
const STATE_WHY_RE = /\bstate\s+why\b/i;
const COMMENT_ON_RE = /\bcomment\s+on\b/i;

export function isWordedResponseQuestion(
  questionText: string,
  partLabels: string[] = [],
): boolean {
  const texts = [
    String(questionText ?? "").trim(),
    ...partLabels.map((l) => String(l ?? "").trim()).filter(Boolean),
  ];
  return texts.some((text) => {
    if (!text) return false;
    return (
      WORDED_COMMAND_RE.test(text) ||
      SHOW_REASON_RE.test(text) ||
      GIVE_REASONS_RE.test(text) ||
      STATE_WHY_RE.test(text) ||
      COMMENT_ON_RE.test(text)
    );
  });
}

export function isProseModelAnswer(accepted: string): boolean {
  const t = String(accepted ?? "").trim();
  if (!t || /see marking guide/i.test(t)) return false;
  if (/^[a-d]$/i.test(t)) return false;
  if (/^-?[\d.,]+\s*(?:g|kg|m|cm|mm|s|min|h|hz|j|n|pa|mol|l|ml|%|°|k|w)\b/i.test(t)) return false;
  const numericChars = (t.match(/[\d.+-]/g) ?? []).length;
  if (numericChars > t.length * 0.55 && /\d/.test(t)) return false;
  return /[a-z]{4,}/i.test(t) && /\s/.test(t);
}

export function acceptedAnswersNeedAiMarking(acceptedAnswers: string[]): boolean {
  const accepted = acceptedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  if (!accepted.length) return false;
  if (accepted.every((a) => /see marking guide/i.test(a))) return true;
  return accepted.some((a) => isProseModelAnswer(a));
}

export function qualifiesForOpenAiMarking(input: {
  questionText: string;
  questionType?: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
}): boolean {
  const qt = String(input.questionType ?? "").toLowerCase();
  if (qt === "mcq") return false;
  const isLong = qt === "long" || qt === "long_answer";
  const isShort = qt === "short" || qt === "short_answer";
  if (!isLong && !isShort) return false;

  /** Short answers: always eligible for free-tier AI (quota enforced separately). */
  if (isShort) return true;

  const partLabels = input.partLabels ?? [];
  const accepted = input.acceptedAnswers ?? [];

  if (isWordedResponseQuestion(input.questionText, partLabels)) return true;
  return acceptedAnswersNeedAiMarking(accepted);
}

/** Handwriting vision marking — worded prompts only (any question type). */
export function qualifiesForOpenAiHandwriting(input: {
  questionText: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
}): boolean {
  const partLabels = input.partLabels ?? [];
  if (isWordedResponseQuestion(input.questionText, partLabels)) return true;
  return acceptedAnswersNeedAiMarking(input.acceptedAnswers ?? []);
}
