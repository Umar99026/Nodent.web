import { questionStemKey } from "@/lib/builtinQuestionsSeed";
import { canonicalSubjectId } from "@/lib/practiceQuestions";

/** DB row fixes applied when admin loads (updates `custom_questions`, not seed TS files). */
export type AdminBankCorrection = {
  /** Normalized stem must include this substring (case-insensitive). */
  stemIncludes: string;
  subjectId: string;
  topic?: string;
};

/**
 * Known mis-assignments to reconcile on admin load. Add rows here only for one-off
 * migrations; ongoing subject structure is managed in Admin (edit or bulk move).
 */
export const ADMIN_BANK_CORRECTIONS: AdminBankCorrection[] = [
  {
    stemIncludes: "v(t)=3t^2-2",
    subjectId: "specialist-maths",
    topic: "Kinematics",
  },
];

export function matchAdminBankCorrection(question: string): AdminBankCorrection | undefined {
  const stem = questionStemKey(question);
  return ADMIN_BANK_CORRECTIONS.find((c) =>
    stem.includes(c.stemIncludes.trim().toLowerCase()),
  );
}

export function bankCorrectionNeedsApply(
  q: { subjectId: string; topic?: string; question: string },
  fix: AdminBankCorrection,
): boolean {
  const sid = canonicalSubjectId(q.subjectId);
  const target = canonicalSubjectId(fix.subjectId);
  if (sid !== target) return true;
  if (fix.topic && String(q.topic ?? "").trim() !== fix.topic) return true;
  return false;
}
