export const PRACTICE_EXAM_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026] as const;

export type PracticeExamYear = (typeof PRACTICE_EXAM_YEARS)[number];

export const PRACTICE_EXAM_NUMBERS = [1, 2] as const;

export type PracticeExamNumber = (typeof PRACTICE_EXAM_NUMBERS)[number];

export function isPracticeExamYear(value: string): value is `${PracticeExamYear}` {
  const year = Number(value);
  return PRACTICE_EXAM_YEARS.includes(year as PracticeExamYear);
}

export function isPracticeExamNumber(value: string): value is `${PracticeExamNumber}` {
  const n = Number(value);
  return n === 1 || n === 2;
}

export function parsePracticeExamNumber(value: unknown): PracticeExamNumber {
  return Number(value) === 2 ? 2 : 1;
}

export function practiceExamLabel(year: PracticeExamYear): string {
  return `${year} Exam`;
}

export function practiceExamPaperLabel(examNumber: PracticeExamNumber): string {
  return `Exam ${examNumber}`;
}

export function practiceExamFullLabel(
  year: PracticeExamYear | number,
  examNumber: PracticeExamNumber,
): string {
  return `${year} — Exam ${examNumber}`;
}
