import type { Question } from "@/lib/subjects";

/**
 * Stable per-question key: custom `id`, else index in the loaded `questions` bank (never shuffle/filter index).
 */
export function questionKeyStable(
  subjectId: string,
  q: Question | null,
  stableIndex: number,
): string {
  if (!q) return `${subjectId}_q${stableIndex}`;
  if (q.id != null) return `${subjectId}_qid_${q.id}`;
  return `${subjectId}_q${stableIndex}`;
}

export function getStableQuestionIndex(
  questions: Question[],
  q: Question | null,
): number {
  if (!q) return -1;
  const direct = questions.indexOf(q);
  if (direct >= 0) return direct;
  if (q.id != null) {
    const byId = questions.findIndex((x) => x.id === q.id);
    if (byId >= 0) return byId;
  }
  return questions.findIndex(
    (x) =>
      x.type === q.type &&
      x.topic === q.topic &&
      x.question === q.question,
  );
}

export function resolveAnswerKey(
  subjectId: string,
  key: string,
  questions: Question[],
  randomizedQuestions: Question[],
): { q: Question; canonicalKey: string } | null {
  const esc = subjectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const qidM = key.match(new RegExp(`^${esc}_qid_(\\d+)$`));
  if (qidM) {
    const id = Number(qidM[1]);
    const q = questions.find((x) => x.id === id);
    if (q) {
      const si = getStableQuestionIndex(questions, q);
      return {
        q,
        canonicalKey: questionKeyStable(subjectId, q, si >= 0 ? si : 0),
      };
    }
    return null;
  }

  const qnM = key.match(new RegExp(`^${esc}_q(\\d+)$`));
  if (qnM) {
    const n = Number(qnM[1]);
    if (n >= 0 && n < questions.length) {
      const q = questions[n];
      const si = getStableQuestionIndex(questions, q);
      return {
        q,
        canonicalKey: questionKeyStable(subjectId, q, si >= 0 ? si : n),
      };
    }
    if (n >= 0 && n < randomizedQuestions.length) {
      const q = randomizedQuestions[n];
      const si = getStableQuestionIndex(questions, q);
      if (si >= 0) {
        return {
          q,
          canonicalKey: questionKeyStable(subjectId, q, si),
        };
      }
    }
  }

  return null;
}

/** Merge legacy keys into canonical stable keys. */
export function normalizeAnswerMap(
  subjectId: string,
  raw: Record<string, boolean | null>,
  questions: Question[],
  randomizedQuestions: Question[],
): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    const r = resolveAnswerKey(subjectId, k, questions, randomizedQuestions);
    if (r) {
      const ck = r.canonicalKey;
      const prev = out[ck];
      if (v === false || prev === false) out[ck] = false;
      else if (v === true || prev === true) out[ck] = true;
      else out[ck] = v;
    } else {
      out[k] = v;
    }
  }
  return out;
}
