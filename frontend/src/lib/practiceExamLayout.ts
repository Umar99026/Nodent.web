import { mcqPlacementCount } from "@/lib/practiceExamMcq";
import type { PracticeExamLayout, PracticeExamMcqItem, PracticeExamPage, PracticeExamSlot } from "@/lib/practiceExamTypes";
import type { PracticeExamNumber } from "@/lib/practiceExams";

/** Default student-facing layout for a subject + exam paper. */
export function defaultPracticeExamLayout(
  subjectId: string,
  examNumber: PracticeExamNumber,
): PracticeExamLayout {
  const sid = String(subjectId).toLowerCase();
  if (sid === "methods" && examNumber === 2) return "mcq_then_written";
  return "written";
}

/** How many multiple-choice questions appear before the written section (0 = none). */
export function defaultMcqCount(subjectId: string, examNumber: PracticeExamNumber): number {
  const sid = String(subjectId).toLowerCase();
  if (sid === "methods" && examNumber === 2) return 20;
  return 0;
}

export function practiceExamLayoutLabel(layout: PracticeExamLayout): string {
  if (layout === "mcq_then_written") return "Multiple choice, then written";
  return "Written (on exam paper)";
}

/** PDF page range where MCQ questions live (1-based). Methods Exam 2: Q1 starts p.2, MCQs end p.12. */
export function mcqPdfPageRange(
  subjectId: string,
  examNumber: PracticeExamNumber,
): { startPage: number; endPage: number } | null {
  const sid = String(subjectId).toLowerCase();
  if (sid === "methods" && examNumber === 2) {
    return { startPage: 2, endPage: 12 };
  }
  return null;
}

/** Pages shown in Part B — excludes MCQ-only pages so students don't re-scroll Q1–20. */
export function writtenSectionPages(
  pages: PracticeExamPage[],
  writtenSlots: PracticeExamSlot[],
  mcqItems: PracticeExamMcqItem[],
): PracticeExamPage[] {
  const mcqPageNums = new Set(
    mcqItems
      .filter((item) => item.pageNumber && mcqPlacementCount(item) > 0)
      .map((item) => item.pageNumber!),
  );
  const maxMcqPage = mcqPageNums.size ? Math.max(...mcqPageNums) : 0;

  return pages.filter((page) => {
    if (writtenSlots.some((slot) => slot.pageNumber === page.pageNumber)) return true;
    if (mcqPageNums.has(page.pageNumber)) return false;
    return maxMcqPage > 0 ? page.pageNumber > maxMcqPage : true;
  });
}
