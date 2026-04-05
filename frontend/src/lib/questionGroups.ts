import type { Question } from "@/lib/subjects";
import { getStableQuestionIndex } from "@/lib/practiceKeys";
import { getQuestionGroupKey } from "@/lib/quizShuffle";

export interface QuestionStimulusGroup {
  key: string;
  passage?: string;
  parts: Question[];
}

/** Merge adjacent questions in a shuffled list that share the same stimulus group. */
export function buildGroupsFromOrderedFlat(
  orderedFlat: Question[],
  bank: Question[],
): QuestionStimulusGroup[] {
  if (orderedFlat.length === 0) return [];
  const out: QuestionStimulusGroup[] = [];
  for (const q of orderedFlat) {
    const key = getQuestionGroupKey(q, bank);
    const passage =
      typeof q.passage === "string" && q.passage.trim()
        ? q.passage.trim()
        : undefined;
    const last = out[out.length - 1];
    if (last && last.key === key) {
      last.parts.push(q);
      if (!last.passage && passage) last.passage = passage;
    } else {
      out.push({ key, passage, parts: [q] });
    }
  }
  return out;
}

/** All parts in the bank belonging to the same stimulus group (sorted). */
export function getAllPartsInGroup(groupKey: string, bank: Question[]): Question[] {
  const parts = bank.filter((q) => getQuestionGroupKey(q, bank) === groupKey);
  parts.sort(
    (a, b) =>
      getStableQuestionIndex(bank, a) - getStableQuestionIndex(bank, b),
  );
  return parts;
}
