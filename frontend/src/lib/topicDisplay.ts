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

export function displayTopicLabel(topic: string): string {
  if (isPracticeExamTopic(topic)) return "Practice exam";
  return String(topic ?? "").trim() || "General";
}

export function practiceHrefForTopic(subjectId: string, topic: string): string {
  if (isPracticeExamTopic(topic)) return `/practice/${subjectId}/exams`;
  return `/quiz/${subjectId}?topic=${encodeURIComponent(topic)}`;
}

export function recommendationTitleForTopic(topic: string): string {
  if (isPracticeExamTopic(topic)) return "Practice exam";
  return `Practice ${displayTopicLabel(topic)}`;
}

/** Action-oriented dashboard title when stats show a weak area. */
export function improvementTitleForTopic(topic: string): string {
  if (isPracticeExamTopic(topic)) return "Improve on practice exams";
  return `Improve ${displayTopicLabel(topic)}`;
}
