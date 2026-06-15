import type { Question } from "@/lib/subjects";
import { getStableQuestionIndex } from "@/lib/practiceKeys";

/**
 * Questions with the same explicit `groupId` are one stimulus group.
 * Each DB row is otherwise its own item (multipart lives in answerParts on one row).
 */
export function getQuestionGroupKey(q: Question, bank: Question[]): string {
  const anyQ = q as unknown as { groupId?: unknown; id?: unknown };
  if (anyQ.groupId != null && String(anyQ.groupId).trim()) {
    return `gid:${String(anyQ.groupId).trim()}`;
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
