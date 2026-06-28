import { apiFetch, apiFetchAdmin } from "@/lib/api";
import { parsePracticeExamNumber, type PracticeExamNumber } from "@/lib/practiceExams";
import type {
  PracticeExamListItem,
  PracticeExamMeta,
  PracticeExamPage,
  PracticeExamSlot,
  PracticeExamLayout,
  PracticeExamMcqItem,
} from "@/lib/practiceExamTypes";

function examPath(subjectId: string, year: number | string, examNumber: PracticeExamNumber) {
  return `/api/practice-exams/${encodeURIComponent(subjectId)}/${encodeURIComponent(String(year))}/${examNumber}`;
}

function adminExamPath(subjectId: string, year: number | string, examNumber: PracticeExamNumber) {
  return `/api/admin/practice-exams/${encodeURIComponent(subjectId)}/${encodeURIComponent(String(year))}/${examNumber}`;
}

export async function fetchPracticeExamList(
  subjectId: string,
): Promise<PracticeExamListItem[]> {
  const data = await apiFetch<{ exams?: PracticeExamListItem[] }>(
    `/api/practice-exams/${encodeURIComponent(subjectId)}`,
  );
  return Array.isArray(data.exams) ? data.exams : [];
}

export async function fetchPracticeExamMeta(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
): Promise<PracticeExamMeta | null> {
  try {
    return await apiFetch<PracticeExamMeta>(examPath(subjectId, year, examNumber));
  } catch {
    return null;
  }
}

export async function fetchPracticeExamPage(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
  pageNumber: number,
): Promise<PracticeExamPage | null> {
  try {
    const data = await apiFetch<{ pageNumber: number; imageDataUrl: string }>(
      `${examPath(subjectId, year, examNumber)}/pages/${pageNumber}`,
    );
    if (!data?.imageDataUrl) return null;
    return { pageNumber: data.pageNumber, imageDataUrl: data.imageDataUrl };
  } catch {
    return null;
  }
}

export async function fetchAdminPracticeExamMeta(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
): Promise<PracticeExamMeta> {
  return apiFetchAdmin<PracticeExamMeta>(adminExamPath(subjectId, year, examNumber));
}

export async function fetchAdminPracticeExamPage(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
  pageNumber: number,
): Promise<PracticeExamPage | null> {
  try {
    const data = await apiFetchAdmin<{ pageNumber: number; imageDataUrl: string }>(
      `${adminExamPath(subjectId, year, examNumber)}/pages/${pageNumber}`,
    );
    if (!data?.imageDataUrl) return null;
    return { pageNumber: data.pageNumber, imageDataUrl: data.imageDataUrl };
  } catch {
    return null;
  }
}

export async function savePracticeExamMeta(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
  payload: {
    slots: PracticeExamSlot[];
    published: boolean;
    layout: PracticeExamLayout;
    mcqCount: number;
    mcqItems: PracticeExamMcqItem[];
  },
): Promise<void> {
  await apiFetchAdmin(adminExamPath(subjectId, year, examNumber), {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function savePracticeExamPage(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
  page: PracticeExamPage,
): Promise<void> {
  await apiFetchAdmin(`${adminExamPath(subjectId, year, examNumber)}/pages/${page.pageNumber}`, {
    method: "PUT",
    body: JSON.stringify({ imageDataUrl: page.imageDataUrl }),
  });
}

export async function deletePracticeExam(
  subjectId: string,
  year: number,
  examNumber: PracticeExamNumber,
): Promise<void> {
  await apiFetchAdmin(adminExamPath(subjectId, year, examNumber), { method: "DELETE" });
}

/** Normalise API / route params to 1 or 2. */
export { parsePracticeExamNumber };
