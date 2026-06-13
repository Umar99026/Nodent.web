import { inferGeneralMathsAreaOfStudy } from "@/lib/generalMathsAreaTopic";
import { inferMethodsAreaOfStudy } from "@/lib/methodsAreaTopic";
import { GOOGLE_SHEETS_TOPIC_LABELS } from "@/lib/mathSubjectTopics";
import { canonicalSubjectId } from "@/lib/practiceQuestions";
import { inferSpecialistMathsAreaOfStudy } from "@/lib/specialistMathsAreaTopic";

/** Demo uses General Mathematics topic labels for practice filters. */
export function topicLabelsForSubject(subjectId: string): readonly string[] {
  const sid = canonicalSubjectId(subjectId);
  const key = sid === "demo" ? "general-maths" : sid;
  return GOOGLE_SHEETS_TOPIC_LABELS[key] ?? ["General"];
}

export function inferPdfQuestionTopic(
  subjectId: string,
  questionText: string,
  passage?: string,
): string {
  const sid = canonicalSubjectId(subjectId);
  if (sid === "methods") {
    return inferMethodsAreaOfStudy("General", questionText, passage);
  }
  if (sid === "specialist-maths") {
    return inferSpecialistMathsAreaOfStudy("General", questionText, passage);
  }
  if (sid === "general-maths" || sid === "demo") {
    return inferGeneralMathsAreaOfStudy("General", questionText, passage);
  }
  return "General";
}
