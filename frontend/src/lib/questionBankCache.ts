import { apiFetch, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  canonicalSubjectId,
  getRawCustomQuestionsForSubject,
  practiceQuestionsForSubject,
} from "@/lib/practiceQuestions";
import { GENERAL_MATHS_BUILTIN_QUESTIONS } from "@/lib/generalMathsBuiltinQuestions";
import type { Question } from "@/lib/subjects";

/** Fired after admin saves or bootstrap refreshes the global question bank. */
export const QUESTIONS_UPDATED_EVENT = "nodent:questions-updated";

export function readCustomQuestionsCache(): Record<string, unknown[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customQuestions);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Drop one subject from the browser cache (e.g. after delete-by-subject). */
export function purgeCustomQuestionsForSubject(subjectId: string): void {
  const want = canonicalSubjectId(subjectId);
  const map = readCustomQuestionsCache();
  let changed = false;
  for (const key of Object.keys(map)) {
    if (canonicalSubjectId(key) !== want) continue;
    delete map[key];
    changed = true;
  }
  if (!changed) return;
  localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(map));
  window.dispatchEvent(
    new CustomEvent(QUESTIONS_UPDATED_EVENT, { detail: map }),
  );
}

/** Pull latest `custom_questions` from the server and update localStorage + listeners. */
export async function refreshCustomQuestionsCache(): Promise<
  Record<string, unknown[]>
> {
  const data = await apiFetch<{ customQuestions?: Record<string, unknown[]> }>(
    API_PATHS.bootstrap,
    { timeoutMs: BOOTSTRAP_FETCH_TIMEOUT_MS },
  );
  const map = data.customQuestions ?? {};
  localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(map));
  window.dispatchEvent(
    new CustomEvent(QUESTIONS_UPDATED_EVENT, { detail: map }),
  );
  return map;
}

/** Built-in maths + admin DB questions for practice, quiz, and dojo. */
export function loadPracticeBank(
  subjectId: string,
  cache?: Record<string, unknown[]>,
): Question[] {
  const sid = canonicalSubjectId(subjectId);
  const map = cache ?? readCustomQuestionsCache();
  const raw = getRawCustomQuestionsForSubject(map, subjectId);
  const fromDb = practiceQuestionsForSubject(raw, subjectId);
  const builtIn =
    sid === "general-maths" || sid === "demo"
      ? GENERAL_MATHS_BUILTIN_QUESTIONS
      : [];
  const merged = [...builtIn, ...fromDb];
  // Lightweight dedupe: question stems can collide between built-ins and DB.
  const seen = new Set<string>();
  return merged.filter((q) => {
    const key = `${q.type}:${String(q.topic ?? "").trim().toLowerCase()}:${String(q.question ?? "")
      .trim()
      .toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
