import { inferGeneralMathsAreaOfStudy } from "@/lib/generalMathsAreaTopic";
import { inferMethodsAreaOfStudy } from "@/lib/methodsAreaTopic";
import { GOOGLE_SHEETS_TOPIC_LABELS, topicTaxonomySubjectId } from "@/lib/mathSubjectTopics";
import { canonicalSubjectId } from "@/lib/practiceQuestions";
import { inferSpecialistMathsAreaOfStudy } from "@/lib/specialistMathsAreaTopic";

export function topicLabelsForSubject(subjectId: string): readonly string[] {
  const key = topicTaxonomySubjectId(canonicalSubjectId(subjectId));
  return GOOGLE_SHEETS_TOPIC_LABELS[key] ?? ["General"];
}

export function inferPdfQuestionTopic(
  subjectId: string,
  questionText: string,
  passage?: string,
): string {
  const taxonomyKey = topicTaxonomySubjectId(canonicalSubjectId(subjectId));
  if (taxonomyKey === "methods") {
    return inferMethodsAreaOfStudy("General", questionText, passage);
  }
  if (taxonomyKey === "specialist-maths") {
    return inferSpecialistMathsAreaOfStudy("General", questionText, passage);
  }
  if (taxonomyKey === "general-maths") {
    return inferGeneralMathsAreaOfStudy("General", questionText, passage);
  }
  return "General";
}
