import type { Question } from "@/lib/subjects";
import { getStableQuestionIndex } from "@/lib/practiceKeys";

function extractMainQuestionNumber(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const s = text.trim();
  if (!s) return null;
  const withWord = s.match(/^question\s+(\d{1,4})\b/i);
  if (withWord?.[1]) return withWord[1];
  const plain = s.match(/^(\d{1,4})\s*[a-z]?(?:\([a-z]\))?[.)]?\b/i);
  if (plain?.[1]) return plain[1];
  return null;
}

function normalizeGroupSeed(text: unknown): string {
  if (typeof text !== "string") return "";
  const firstLine = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean) ?? "";
  return firstLine
    .toLowerCase()
    .replace(/^question\s+\d{1,4}\s*(?:\(\d+\s*marks?\))?\s*[:.)-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

/**
 * Questions with the same `groupId`, or the same non-empty `passage`, are one stimulus group.
 * Others are singletons (stable index + id).
 */
export function getQuestionGroupKey(q: Question, bank: Question[]): string {
  const anyQ = q as unknown as { groupId?: unknown; passage?: unknown; id?: unknown };
  if (anyQ.groupId != null && String(anyQ.groupId).trim()) {
    return `gid:${String(anyQ.groupId).trim()}`;
  }
  const mainFromPassage = extractMainQuestionNumber(anyQ.passage);
  if (mainFromPassage) {
    const seed = normalizeGroupSeed(anyQ.passage);
    return seed ? `qnum:${mainFromPassage}:${seed}` : `qnum:${mainFromPassage}`;
  }
  // Only use question-number fallback when there is no passage text.
  // Include topic to avoid collapsing unrelated "Question 4" items from different sets.
  const mainFromQuestion = extractMainQuestionNumber((q as any).question);
  if (mainFromQuestion) {
    const topic = String((q as any).topic ?? "").trim().toLowerCase();
    return `qnumq:${mainFromQuestion}:${topic || "general"}`;
  }
  if (typeof anyQ.passage === "string" && anyQ.passage.trim()) {
    return `passage:${anyQ.passage.trim()}`;
  }
  const idx = getStableQuestionIndex(bank, q);
  const solo = idx >= 0 ? idx : 0;
  return `solo:${solo}_${anyQ.id != null ? String(anyQ.id) : "noid"}`;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const a = [...arr];
  const rand = mulberry32(hashSeed(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededShuffleGroups<T>(
  items: T[],
  seedStr: string,
  groupKey: (item: T) => string,
  sortWithinGroup?: (a: T, b: T) => number,
): T[] {
  const groups: { key: string; items: T[] }[] = [];
  const idx = new Map<string, number>();
  for (const it of items) {
    const k = groupKey(it);
    const existing = idx.get(k);
    if (existing == null) {
      idx.set(k, groups.length);
      groups.push({ key: k, items: [it] });
    } else {
      groups[existing].items.push(it);
    }
  }
  for (const g of groups) {
    if (sortWithinGroup) g.items.sort(sortWithinGroup);
  }
  const shuffledGroups = seededShuffle(groups, seedStr);
  return shuffledGroups.flatMap((g) => g.items);
}

/** Same order as practice / quiz for this user and subject. */
export function randomizedQuestionsForSubject(
  questions: Question[],
  userId: number | string,
  subjectId: string,
): Question[] {
  if (!questions.length) return [];
  return seededShuffleGroups(
    questions,
    `${userId}:${subjectId}`,
    (q) => getQuestionGroupKey(q, questions),
    (a, b) => {
      const aa = a as unknown as { id?: unknown };
      const bb = b as unknown as { id?: unknown };
      const ai = typeof aa.id === "number" ? aa.id : Number(aa.id);
      const bi = typeof bb.id === "number" ? bb.id : Number(bb.id);
      if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
      return 0;
    },
  );
}
