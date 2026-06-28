import { apiFetchAdmin } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  buildAnswerPartsPayload,
  type MultipartPartDraft,
} from "@/components/admin/MultipartAnswerPartsEditor";
import {
  compressFigureDataUrl,
  DB_SAFE_DATA_URL_CHARS,
} from "@/lib/imageCompressor";
import {
  QUESTIONS_UPDATED_EVENT,
  readCustomQuestionsCache,
} from "@/lib/questionBankCache";
import { canonicalSubjectId } from "@/lib/practiceQuestions";

export type AdminQuestionType = "mcq" | "short_answer" | "long_answer";

export type AdminQuestionSaveDraft = {
  subjectId: string;
  type: AdminQuestionType;
  topic: string;
  question: string;
  passage?: string | null;
  marks: number;
  guidance?: string | null;
  imageUrls?: string[];
  options?: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
  answerParts?: MultipartPartDraft[];
};

/** Match bootstrap cache shape (`short` / `long`) so practice reloads edited rows. */
function cacheQuestionType(adminType: AdminQuestionType): string {
  if (adminType === "long_answer") return "long";
  if (adminType === "short_answer") return "short";
  return adminType;
}

function draftHasMultipartParts(draft: AdminQuestionSaveDraft): boolean {
  return (draft.answerParts?.filter((p) => p.label.trim()).length ?? 0) >= 2;
}

function isDataUrl(url: string): boolean {
  return /^data:/i.test(url.trim());
}

async function safeCompressDataUrl(url: string): Promise<string> {
  if (!isDataUrl(url)) return url;
  if (url.length <= DB_SAFE_DATA_URL_CHARS) return url;
  try {
    return await compressFigureDataUrl(url);
  } catch {
    throw new Error(
      "Could not compress an image. Crop it tighter or use a smaller screenshot.",
    );
  }
}

async function compressDraftImages(
  draft: AdminQuestionSaveDraft,
): Promise<AdminQuestionSaveDraft> {
  const imageUrls = draft.imageUrls?.length
    ? await Promise.all(draft.imageUrls.map((u) => safeCompressDataUrl(u)))
    : draft.imageUrls;

  const answerParts = draft.answerParts?.length
    ? await Promise.all(
        draft.answerParts.map(async (part) => ({
          ...part,
          imageUrl:
            part.imageUrl && isDataUrl(part.imageUrl)
              ? await safeCompressDataUrl(part.imageUrl)
              : part.imageUrl,
        })),
      )
    : draft.answerParts;

  return { ...draft, imageUrls, answerParts };
}

export function buildAdminQuestionPutBody(
  draft: AdminQuestionSaveDraft,
  opts?: { imageUrls?: string[] | null },
): Record<string, unknown> {
  const editParts = draft.answerParts ?? [];
  const editMultipart = draftHasMultipartParts(draft);

  const body: Record<string, unknown> = {
    subjectId: draft.subjectId,
    type: draft.type,
    topic: draft.topic,
    question: draft.question.trim(),
    passage: draft.passage?.trim() || null,
    marks: draft.marks,
    guidance: draft.guidance?.trim() || null,
  };

  if (opts && "imageUrls" in opts) {
    if (opts.imageUrls === null) {
      // Data URLs attach via attach-images-bulk — never in PUT.
    } else if (Array.isArray(opts.imageUrls)) {
      body.imageUrls = opts.imageUrls;
    }
  } else {
    const httpOnly = (draft.imageUrls ?? []).filter((u) => !isDataUrl(u));
    if (httpOnly.length) body.imageUrls = httpOnly;
  }

  if (draft.type === "mcq") {
    body.options = draft.options ?? [];
    body.correctAnswer = draft.correctAnswer ?? "";
    return body;
  }

  if (editMultipart) {
    const payloadParts = buildAnswerPartsPayload(editParts);
    body.answerParts = payloadParts;
    body.acceptedAnswers = editParts
      .map((p) => (p.acceptedAnswer ?? "").trim())
      .filter(Boolean);
    body.marks =
      payloadParts.reduce((sum, p) => sum + (p.marks ?? 0), 0) || draft.marks;
    return body;
  }

  body.acceptedAnswers = draft.acceptedAnswers ?? [];
  return body;
}

/** Update localStorage immediately so practice reflects edits without waiting on bootstrap. */
export function patchCachedQuestionAfterAdminSave(
  questionId: number | string,
  draft: AdminQuestionSaveDraft,
  subjectId: string,
): void {
  const map = readCustomQuestionsCache();
  const sid = canonicalSubjectId(subjectId);
  const wantId = String(questionId);
  let changed = false;

  for (const [key, arr] of Object.entries(map)) {
    if (!Array.isArray(arr) || canonicalSubjectId(key) !== sid) continue;
    for (let i = 0; i < arr.length; i++) {
      const row = arr[i];
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      if (String(r.id ?? "") !== wantId) continue;

      const editParts = draft.answerParts ?? [];
      const editMultipart = draftHasMultipartParts(draft);
      const next: Record<string, unknown> = {
        ...r,
        id: r.id,
        subjectId: sid,
        subject_id: sid,
        type: cacheQuestionType(draft.type),
        topic: draft.topic,
        question: draft.question.trim(),
        passage: draft.passage?.trim() || null,
        marks: draft.marks,
        guidance: draft.guidance?.trim() || null,
        imageUrls: draft.imageUrls ?? r.imageUrls,
      };

      if (draft.type === "mcq") {
        next.options = draft.options ?? [];
        next.answer = draft.correctAnswer ?? "";
      } else if (editMultipart) {
        const payloadParts = buildAnswerPartsPayload(editParts);
        next.answerParts = payloadParts;
        next.acceptedAnswers = editParts
          .map((p) => (p.acceptedAnswer ?? "").trim())
          .filter(Boolean);
        next.marks =
          payloadParts.reduce((sum, p) => sum + (p.marks ?? 0), 0) || draft.marks;
      } else {
        next.acceptedAnswers = draft.acceptedAnswers ?? [];
      }

      arr[i] = next;
      changed = true;
      break;
    }
    if (changed) break;
  }

  if (!changed) return;
  localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(map));
  window.dispatchEvent(
    new CustomEvent(QUESTIONS_UPDATED_EVENT, { detail: map }),
  );
}

/** Save question to the admin API (same DB row Admin uses). */
export async function saveAdminQuestion(
  questionId: number | string,
  draft: AdminQuestionSaveDraft,
): Promise<AdminQuestionSaveDraft> {
  const id = Number(questionId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("Invalid question id.");
  }

  const prepared = await compressDraftImages({
    ...draft,
    question: draft.question.trim(),
  });

  const allImages = prepared.imageUrls ?? [];
  const httpImages = allImages.filter((u) => !isDataUrl(u));
  const dataImages = allImages.filter(isDataUrl);
  const hasDataImages = dataImages.length > 0;

  const body = buildAdminQuestionPutBody(prepared, {
    imageUrls: hasDataImages
      ? null
      : httpImages.length
        ? httpImages
        : undefined,
  });

  await apiFetchAdmin(`${API_PATHS.admin.questions}/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

  if (hasDataImages) {
    const finalImages = [...httpImages, ...dataImages];
    const result = await apiFetchAdmin<{
      ok?: boolean;
      updated?: number;
      errors?: { message: string }[];
    }>(API_PATHS.admin.questionsAttachImagesBulk, {
      method: "POST",
      body: JSON.stringify({
        mappings: [{ questionId: id, image_urls_json: finalImages }],
      }),
    });
    const attachErrors =
      result?.errors?.map((e) => e.message?.trim()).filter(Boolean) ?? [];
    if (attachErrors.length) {
      throw new Error(attachErrors[0]!);
    }
    if ((result?.updated ?? 0) < 1) {
      throw new Error("Image upload did not complete. Try cropping the figure smaller.");
    }
  }

  return prepared;
}

export async function refreshQuestionBankAfterSave(): Promise<void> {
  const { apiFetchAdmin } = await import("@/lib/api");
  const { refreshCustomQuestionsCache } = await import("@/lib/questionBankCache");

  try {
    const list = await apiFetchAdmin<Array<Record<string, unknown>>>(
      API_PATHS.admin.questions,
    );
    const grouped: Record<string, unknown[]> = {};
    for (const row of list ?? []) {
      const sid = canonicalSubjectId(String(row.subjectId ?? row.subject_id ?? ""));
      if (!sid) continue;
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push({
        ...row,
        id: typeof row.id === "number" ? row.id : Number(row.id) || row.id,
        subjectId: sid,
        subject_id: sid,
      });
    }
    localStorage.setItem(STORAGE_KEYS.customQuestions, JSON.stringify(grouped));
    window.dispatchEvent(
      new CustomEvent(QUESTIONS_UPDATED_EVENT, { detail: grouped }),
    );
  } catch {
    try {
      await refreshCustomQuestionsCache();
    } catch {
      /* local patch already applied */
    }
  }
}
