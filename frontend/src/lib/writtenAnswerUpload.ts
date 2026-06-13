import type { Question } from "@/lib/subjects";

/**
 * Whether this question should offer phone QR upload for answer images
 * (graphs, diagrams, working) in Practice / Study.
 */
export function questionSupportsAnswerUpload(q: Question): boolean {
  // Available across all subjects for written-style responses.
  return q.type === "long" || q.type === "short";
}

/** Encode path segments for `/api/written/...` routes. */
export function writtenApiPath(
  subjectId: string,
  questionKey: string,
  suffix: "" | "/all" | "/rate" | "/mark" = "",
): string {
  return `/api/written/${encodeURIComponent(subjectId)}/${encodeURIComponent(questionKey)}${suffix}`;
}
