import { GENERAL_MATHS_BUILTIN_QUESTIONS } from "@/lib/generalMathsBuiltinQuestions";
import { GENERAL_MATHS_BUILTIN_SHORT_TRICKY } from "@/lib/generalMathsBuiltinShortTricky";
import { METHODS_BUILTIN_QUESTIONS } from "@/lib/methodsBuiltinQuestions";
import { SPECIALIST_MATHS_BUILTIN_QUESTIONS } from "@/lib/specialistMathsBuiltinQuestions";
import { canonicalSubjectId } from "@/lib/practiceQuestions";
import type { Question } from "@/lib/subjects";

export type BuiltinSeedRow = Record<string, unknown>;

/** Stable stem key for deduping seed rows against the database. */
export function questionStemKey(text: string): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function questionToSeedRow(subjectId: string, q: Question): BuiltinSeedRow {
  const sid = canonicalSubjectId(subjectId);
  const type =
    q.type === "short"
      ? "short_answer"
      : q.type === "long"
        ? "long_answer"
        : "mcq";
  const marks =
    typeof q.marks === "number" && q.marks > 0
      ? q.marks
      : type === "mcq"
        ? 1
        : 2;

  const row: BuiltinSeedRow = {
    subjectId: sid,
    type,
    topic: q.topic ?? "General",
    question: q.question,
    marks,
  };

  if (q.passage) row.passage = q.passage;
  if (q.guidance) row.guidance = q.guidance;
  if (q.imageUrls?.length) row.imageUrls = q.imageUrls;

  if (q.type === "mcq") {
    row.options = q.options;
    row.correctAnswer = q.answer;
  } else if (q.type === "short") {
    row.acceptedAnswers = q.acceptedAnswers;
  } else {
    if (q.acceptedAnswers?.length) row.acceptedAnswers = q.acceptedAnswers;
    if (q.answer) row.answer = q.answer;
  }

  return row;
}

function dedupeSeedRows(rows: BuiltinSeedRow[]): BuiltinSeedRow[] {
  const seen = new Set<string>();
  const out: BuiltinSeedRow[] = [];
  for (const row of rows) {
    const sid = canonicalSubjectId(String(row.subjectId ?? ""));
    const key = `${sid}::${questionStemKey(String(row.question ?? ""))}`;
    if (!key.endsWith("::") && !seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

/** All legacy built-in maths questions as rows for `POST /api/admin/questions/bulk`. */
export function getAllBuiltinSeedRows(): BuiltinSeedRow[] {
  const rows: BuiltinSeedRow[] = [];
  for (const q of METHODS_BUILTIN_QUESTIONS) {
    rows.push(questionToSeedRow("methods", q));
  }
  for (const q of GENERAL_MATHS_BUILTIN_SHORT_TRICKY) {
    rows.push(questionToSeedRow("general-maths", q));
  }
  for (const q of GENERAL_MATHS_BUILTIN_QUESTIONS) {
    rows.push(questionToSeedRow("general-maths", q));
  }
  for (const q of SPECIALIST_MATHS_BUILTIN_QUESTIONS) {
    rows.push(questionToSeedRow("specialist-maths", q));
  }
  return dedupeSeedRows(rows);
}

export function builtinSeedRowsForSubject(subjectId: string): BuiltinSeedRow[] {
  const sid = canonicalSubjectId(subjectId);
  return getAllBuiltinSeedRows().filter(
    (r) => canonicalSubjectId(String(r.subjectId)) === sid,
  );
}
