import type { Question } from "@/lib/subjects";
import { canonicalSubjectId } from "@/lib/practiceQuestions";

/**
 * Stable per-question key: custom `id`, else index in the loaded `questions` bank (never shuffle/filter index).
 */
export function questionKeyStable(
  subjectId: string,
  q: Question | null,
  stableIndex: number,
): string {
  const sid = canonicalSubjectId(subjectId);
  if (!q) return `${sid}_q${stableIndex}`;
  if (q.id != null) return `${sid}_qid_${q.id}`;
  return `${sid}_q${stableIndex}`;
}

export function getStableQuestionIndex(
  questions: Question[],
  q: Question | null,
): number {
  if (!q) return -1;
  const direct = questions.indexOf(q);
  if (direct >= 0) return direct;
  if (q.id != null) {
    const id = Number(q.id);
    const byId = questions.findIndex(
      (x) => x.id != null && Number(x.id) === id,
    );
    if (byId >= 0) return byId;
  }
  return questions.findIndex(
    (x) =>
      x.type === q.type &&
      x.topic === q.topic &&
      x.question === q.question,
  );
}

function questionStemFingerprint(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 280);
}

/** Subject id strings that may appear as a prefix in saved answer keys. */
export function subjectIdKeyPrefixes(subjectId: string): string[] {
  const canonical = canonicalSubjectId(subjectId);
  const out = new Set<string>([subjectId, canonical]);
  const aliasToCanonical: Record<string, string> = {
    "mathematical methods": "methods",
    "mathematical-methods": "methods",
    "math methods": "methods",
    mm: "methods",
    "general mathematics": "general-maths",
    "general maths": "general-maths",
    "general-mathematics": "general-maths",
    "further mathematics": "further-maths",
    "further maths": "further-maths",
    "specialist mathematics": "specialist-maths",
    "specialist maths": "specialist-maths",
  };
  for (const [alias, can] of Object.entries(aliasToCanonical)) {
    if (can === canonical) out.add(alias);
  }
  return [...out];
}

function parseKeyedSuffix(
  key: string,
): { prefix: string; suffix: string } | null {
  const m = key.match(/^(.+?)(_qid_\d+|_q\d+)$/);
  if (!m) return null;
  return { prefix: m[1], suffix: m[2] };
}

function findQuestionById(questions: Question[], id: number): Question | null {
  return (
    questions.find((x) => x.id != null && Number(x.id) === id) ?? null
  );
}

function resolveAnswerKeyDirect(
  subjectId: string,
  key: string,
  questions: Question[],
  randomizedQuestions: Question[],
): { q: Question; canonicalKey: string } | null {
  const sid = canonicalSubjectId(subjectId);
  const esc = sid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const qidM = key.match(new RegExp(`^${esc}_qid_(\\d+)$`));
  if (qidM) {
    const id = Number(qidM[1]);
    const q = findQuestionById(questions, id);
    if (q) {
      const si = getStableQuestionIndex(questions, q);
      return {
        q,
        canonicalKey: questionKeyStable(sid, q, si >= 0 ? si : 0),
      };
    }
    return null;
  }

  const qnM = key.match(new RegExp(`^${esc}_q(\\d+)$`));
  if (qnM) {
    const n = Number(qnM[1]);
    const indexCandidates = [n, n - 1].filter(
      (idx, i, arr) =>
        idx >= 0 &&
        (i === 0 || (idx !== n && !arr.includes(idx))),
    );
    for (const idx of indexCandidates) {
      if (idx < questions.length) {
        const q = questions[idx];
        const si = getStableQuestionIndex(questions, q);
        return {
          q,
          canonicalKey: questionKeyStable(sid, q, si >= 0 ? si : idx),
        };
      }
      if (idx < randomizedQuestions.length) {
        const q = randomizedQuestions[idx];
        const si = getStableQuestionIndex(questions, q);
        if (si >= 0) {
          return {
            q,
            canonicalKey: questionKeyStable(sid, q, si),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Resolve a saved practice answer key to a question in the current bank.
 * Handles legacy subject prefixes, shuffle indices, and question-text keys.
 */
export function resolveQuestionForPractice(
  subjectId: string,
  key: string,
  questions: Question[],
  randomizedQuestions: Question[],
  extraQuestions: Question[] = [],
): { q: Question; canonicalKey: string } | null {
  if (!key || !questions.length) return null;

  const sid = canonicalSubjectId(subjectId);
  const bank =
    extraQuestions.length > 0
      ? [...questions, ...extraQuestions]
      : questions;
  const rand =
    randomizedQuestions.length > 0 ? randomizedQuestions : bank;

  const direct = resolveAnswerKeyDirect(sid, key, bank, rand);
  if (direct) return direct;

  const parsed = parseKeyedSuffix(key);
  if (parsed) {
    for (const prefix of subjectIdKeyPrefixes(subjectId)) {
      const trial = `${canonicalSubjectId(prefix)}${parsed.suffix}`;
      const hit = resolveAnswerKeyDirect(sid, trial, bank, rand);
      if (hit) return hit;
    }
  }

  for (let i = 0; i < bank.length; i++) {
    const q = bank[i];
    const ck = questionKeyStable(sid, q, i);
    if (ck === key) return { q, canonicalKey: ck };
    for (const prefix of subjectIdKeyPrefixes(subjectId)) {
      const alt = questionKeyStable(prefix, q, i);
      if (alt === key) return { q, canonicalKey: ck };
    }
  }

  const keyStem = questionStemFingerprint(key);
  if (keyStem.length >= 20) {
    for (let i = 0; i < bank.length; i++) {
      const q = bank[i];
      const qs = questionStemFingerprint(String(q.question ?? ""));
      if (!qs) continue;
      if (qs === keyStem || qs.startsWith(keyStem) || keyStem.startsWith(qs)) {
        const si = getStableQuestionIndex(questions, q);
        const idx = si >= 0 ? si : i;
        return {
          q: si >= 0 ? questions[si] : q,
          canonicalKey: questionKeyStable(sid, q, idx),
        };
      }
    }
  }

  return null;
}

/** @deprecated Prefer resolveQuestionForPractice — kept for call sites. */
export function resolveAnswerKey(
  subjectId: string,
  key: string,
  questions: Question[],
  randomizedQuestions: Question[],
): { q: Question; canonicalKey: string } | null {
  return resolveQuestionForPractice(
    subjectId,
    key,
    questions,
    randomizedQuestions,
  );
}

/** Merge legacy keys into canonical stable keys. */
export function normalizeAnswerMap(
  subjectId: string,
  raw: Record<string, boolean | null>,
  questions: Question[],
  randomizedQuestions: Question[],
  extraQuestions: Question[] = [],
): Record<string, boolean | null> {
  const out: Record<string, boolean | null> = {};
  for (const [k, v] of Object.entries(raw)) {
    const r = resolveQuestionForPractice(
      subjectId,
      k,
      questions,
      randomizedQuestions,
      extraQuestions,
    );
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
