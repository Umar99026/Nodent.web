/** Human-friendly topic labels for dashboard, practice UI, and stats. */
export function isPracticeExamTopic(topic: string): boolean {
  const raw = String(topic ?? "").trim();
  if (!raw) return false;
  const lower = raw.replace(/\s+/g, " ").toLowerCase();
  return (
    /practice\s*exam/i.test(raw) ||
    /^exam\s*import$/i.test(lower) ||
    /examimport/i.test(lower) ||
    /\bexam\s+import\b/i.test(lower)
  );
}

/** DB/import placeholder — not a real curriculum topic for reports or practice filters. */
export function isPlaceholderTopic(topic: unknown): boolean {
  const raw = String(topic ?? "").trim();
  if (!raw) return true;
  if (/^general$/i.test(raw)) return true;
  if (/^(?:test(?:\s*pdf)?|pdf\s*test)$/i.test(raw)) return true;
  return false;
}

export function displayTopicLabel(topic: string): string {
  if (isPracticeExamTopic(topic)) return "Practice exam";
  if (isPlaceholderTopic(topic)) return "";
  return String(topic ?? "").trim();
}

export function practiceHrefForTopic(subjectId: string, topic: string): string {
  if (isPracticeExamTopic(topic)) return `/practice/${subjectId}/exams`;
  return `/quiz/${subjectId}?topic=${encodeURIComponent(topic)}`;
}

export function recommendationTitleForTopic(topic: string): string {
  if (isPracticeExamTopic(topic)) return "Practice exam";
  const label = displayTopicLabel(topic);
  return label ? `Practice ${label}` : "Practice";
}

/** Action-oriented dashboard title when stats show a weak area. */
export function improvementTitleForTopic(topic: string): string {
  if (isPracticeExamTopic(topic)) return "Improve on practice exams";
  const label = displayTopicLabel(topic);
  return label ? `Improve ${label}` : "Improve a topic";
}
