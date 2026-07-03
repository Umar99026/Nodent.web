import type { MultipartPartDraft } from "@/components/admin/MultipartAnswerPartsEditor";
import {
  createEmptyQuestionDraft,
  type QuestionDraft,
} from "@/lib/createAssessmentDraft";
import type { DiagramLabelPart } from "@/lib/diagramLabels";
import { cropImageDataUrl, FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import { transformOverlaysForCrop } from "@/lib/pdfInputBoxDetection";
import {
  isMcqSlotKey,
  questionNumberFromSlotKey,
} from "@/lib/practiceExamImport";
import type { PracticeExamPage, PracticeExamSlot } from "@/lib/practiceExamTypes";
import { partLetterForIndex } from "@/lib/questionDisplay";

export type QuestionImportPage = PracticeExamPage & {
  sourceImageDataUrl?: string;
  cropRect?: CropRect;
  cropping?: boolean;
};

function partLetterFromSlotKey(key: string): string {
  const match = String(key ?? "")
    .trim()
    .match(/^q?\d+\s*[-_.]?\s*([a-z]+)$/i);
  if (!match?.[1]) return "a";
  const part = match[1].toLowerCase();
  if (part === "mcq") return "a";
  return part;
}

function slotToOverlay(slot: PracticeExamSlot): DiagramLabelPart {
  return {
    key: slot.key,
    sourcePartKey: slot.key,
    label: "",
    acceptedAnswer: slot.acceptedAnswer,
    marks: slot.marks ?? 1,
    overlayX: slot.overlayX ?? 0,
    overlayY: slot.overlayY ?? 0,
    overlayW: slot.overlayW ?? 0,
    overlayH: slot.overlayH ?? 0,
    transparentInput: slot.transparentInput,
  };
}

function overlayToSlotFields(overlay: DiagramLabelPart): Pick<
  PracticeExamSlot,
  "overlayX" | "overlayY" | "overlayW" | "overlayH"
> {
  return {
    overlayX: overlay.overlayX,
    overlayY: overlay.overlayY,
    overlayW: overlay.overlayW,
    overlayH: overlay.overlayH,
  };
}

export async function applyQuestionImportPageCrop(
  page: QuestionImportPage,
  slots: PracticeExamSlot[],
  crop: CropRect,
): Promise<{ page: QuestionImportPage; slots: PracticeExamSlot[] }> {
  const source = page.sourceImageDataUrl ?? page.imageDataUrl;
  const cropped = await cropImageDataUrl(source, crop);
  const pageNumber = page.pageNumber;

  const nextSlots: PracticeExamSlot[] = [];
  for (const slot of slots) {
    if (slot.pageNumber !== pageNumber) {
      nextSlots.push(slot);
      continue;
    }
    const [transformed] = transformOverlaysForCrop([slotToOverlay(slot)], crop);
    if (!transformed) continue;
    nextSlots.push({
      ...slot,
      ...overlayToSlotFields(transformed),
    });
  }

  return {
    page: {
      ...page,
      sourceImageDataUrl: source,
      imageDataUrl: cropped,
      cropRect: FULL_CROP,
      cropping: false,
    },
    slots: nextSlots,
  };
}

export function buildQuestionDraftsFromOverlaySlots(
  pages: QuestionImportPage[],
  slots: PracticeExamSlot[],
  topic: string,
): QuestionDraft[] {
  const imageByPage = new Map(pages.map((p) => [p.pageNumber, p.imageDataUrl]));
  const byQuestion = new Map<number, PracticeExamSlot[]>();

  for (const slot of slots) {
    if (
      slot.overlayW == null ||
      slot.overlayH == null ||
      (slot.overlayW ?? 0) <= 0 ||
      (slot.overlayH ?? 0) <= 0
    ) {
      continue;
    }
    const qn = questionNumberFromSlotKey(slot.key);
    if (!qn) continue;
    const list = byQuestion.get(qn) ?? [];
    list.push(slot);
    byQuestion.set(qn, list);
  }

  const drafts: QuestionDraft[] = [];
  for (const qn of [...byQuestion.keys()].sort((a, b) => a - b)) {
    const group = byQuestion.get(qn)!;
    const pageNum = group[0]!.pageNumber;
    const imageUrl = imageByPage.get(pageNum) ?? "";

    if (group.length === 1 && isMcqSlotKey(group[0]!.key)) {
      const slot = group[0]!;
      drafts.push({
        ...createEmptyQuestionDraft(),
        type: "mcq",
        question: slot.label?.trim() || `Question ${qn}`,
        topic,
        marks: slot.marks ?? 1,
        options: ["", "", "", ""],
        correctAnswer: (slot.acceptedAnswer ?? "").trim().toUpperCase().slice(0, 1),
        imageUrls: imageUrl ? [imageUrl] : [],
      });
      continue;
    }

    const sorted = [...group].sort((a, b) =>
      partLetterFromSlotKey(a.key).localeCompare(partLetterFromSlotKey(b.key)),
    );

    const answerParts: MultipartPartDraft[] = sorted.map((slot, index) => {
      const letter = partLetterFromSlotKey(slot.key) || partLetterForIndex(index);
      const overlay = slotToOverlay(slot);
      return {
        key: letter,
        label: `${letter})`,
        marks: slot.marks ?? 1,
        acceptedAnswer: slot.acceptedAnswer ?? "",
        imageUrl,
        labelOverlays: [overlay],
      };
    });

    const marks = answerParts.reduce((sum, p) => sum + (p.marks ?? 1), 0);

    drafts.push({
      ...createEmptyQuestionDraft(),
      type: marks >= 4 ? "long_answer" : "short_answer",
      question: imageUrl ? "See figure." : `Question ${qn}`,
      topic,
      marks: Math.max(1, marks),
      imageUrls: imageUrl ? [imageUrl] : [],
      multipartEnabled: answerParts.length >= 2,
      labelDiagramEnabled: true,
      answerParts:
        answerParts.length >= 2
          ? answerParts
          : answerParts.length === 1
            ? answerParts
            : [],
      acceptedAnswers:
        answerParts.length === 1
          ? (answerParts[0]?.acceptedAnswer ?? "")
          : "",
    });
  }

  return drafts;
}
