import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { DiagramLabelInputs } from "@/components/quiz/DiagramLabelInputs";
import { Button } from "@/components/ui/button";
import type { AnswerSlotSource } from "@/lib/answerSlotOverlays";
import {
  clampOverlay,
  type DiagramLabelPart,
  type OverlayRect,
} from "@/lib/diagramLabels";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import type { QuestionImportPage } from "@/lib/questionPdfOverlayImport";
import type { PracticeExamSlot } from "@/lib/practiceExamTypes";
import { cn } from "@/lib/utils";
import { Loader2, Scissors } from "lucide-react";

function slotToDiagramPart(slot: PracticeExamSlot): DiagramLabelPart {
  return {
    key: slot.key,
    label: "",
    placeholder: "",
    marks: slot.marks,
    acceptedAnswer: slot.acceptedAnswer,
    overlayX: slot.overlayX,
    overlayY: slot.overlayY,
    overlayW: slot.overlayW,
    overlayH: slot.overlayH,
    sourcePartKey: slot.key,
    transparentInput: slot.transparentInput,
  };
}

function diagramPartToSlot(
  part: DiagramLabelPart,
  pageNumber: number,
  existing?: PracticeExamSlot,
): PracticeExamSlot {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    pageNumber,
    key: part.sourcePartKey ?? part.key,
    label: part.label ?? "",
    acceptedAnswer: part.acceptedAnswer ?? "",
    marks: part.marks ?? 1,
    overlayX: part.overlayX,
    overlayY: part.overlayY,
    overlayW: part.overlayW,
    overlayH: part.overlayH,
    transparentInput: part.transparentInput ?? existing?.transparentInput,
  };
}

type AdminPdfOverlayPageEditorProps = {
  page: QuestionImportPage;
  slots: PracticeExamSlot[];
  armedPaletteSlot: AnswerSlotSource | null;
  selectedSlotId: string | null;
  cropping?: boolean;
  crop?: CropRect;
  cropBusy?: boolean;
  onSelectSlot: (id: string | null) => void;
  onSlotsChange: (pageNumber: number, next: PracticeExamSlot[]) => void;
  onPlaceArmedRect: (pageNumber: number, rect: OverlayRect) => void;
  onStartCrop: () => void;
  onCropChange: (crop: CropRect) => void;
  onApplyCrop: (crop: CropRect) => void;
  onCancelCrop: () => void;
};

export function AdminPdfOverlayPageEditor({
  page,
  slots,
  armedPaletteSlot,
  selectedSlotId,
  cropping = false,
  crop = FULL_CROP,
  cropBusy = false,
  onSelectSlot,
  onSlotsChange,
  onPlaceArmedRect,
  onStartCrop,
  onCropChange,
  onApplyCrop,
  onCancelCrop,
}: AdminPdfOverlayPageEditorProps) {
  const pageSlots = slots.filter((s) => s.pageNumber === page.pageNumber);
  const parts = pageSlots.map(slotToDiagramPart);
  const selectedIndex = pageSlots.findIndex((s) => s.id === selectedSlotId);

  const updatePageSlots = (nextParts: DiagramLabelPart[]) => {
    const next = nextParts.map((part, i) =>
      diagramPartToSlot(part, page.pageNumber, pageSlots[i]),
    );
    onSlotsChange(page.pageNumber, next);
  };

  const handleAddRect = (rect: OverlayRect) => {
    if (armedPaletteSlot) {
      onPlaceArmedRect(page.pageNumber, rect);
      return;
    }
    const id = crypto.randomUUID();
    const nextSlot: PracticeExamSlot = {
      id,
      pageNumber: page.pageNumber,
      key: `p${page.pageNumber}-${pageSlots.length + 1}`,
      label: "",
      acceptedAnswer: "",
      marks: 1,
      transparentInput: true,
      ...clampOverlay(rect),
    };
    onSelectSlot(id);
    onSlotsChange(page.pageNumber, [...pageSlots, nextSlot]);
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/8 px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Page {page.pageNumber}
        </p>
        {!cropping ? (
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onStartCrop}>
            <Scissors className="size-3" />
            Crop page
          </Button>
        ) : null}
      </div>
      <div
        className={cn(
          "relative p-2",
          armedPaletteSlot && !cropping && "ring-2 ring-inset ring-brand/30",
        )}
      >
        {cropping ? (
          <div className="rounded-lg border border-black/10 bg-[#fafbfc] p-2">
            <p className="mb-2 text-[11px] text-muted-foreground">
              Trim margins or isolate one question on the page. Input boxes move with the crop.
            </p>
            <PdfPageCropEditor
              imageDataUrl={page.sourceImageDataUrl ?? page.imageDataUrl}
              crop={crop}
              onCropChange={onCropChange}
              onApply={() => onApplyCrop(crop)}
              onCancel={onCancelCrop}
            />
            {cropBusy ? (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Applying crop…
              </p>
            ) : null}
          </div>
        ) : (
          <DiagramLabelInputs
            imageUrl={page.imageDataUrl}
            parts={parts}
            editorMode
            examPaperMode
            selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
            onSelectIndex={(index) => {
              onSelectSlot(index == null ? null : (pageSlots[index]?.id ?? null));
            }}
            onMovePart={(index, overlay) => {
              const next = parts.map((p, i) =>
                i === index ? { ...p, ...clampOverlay(overlay) } : p,
              );
              updatePageSlots(next);
            }}
            onResizePart={(index, overlay) => {
              const next = parts.map((p, i) =>
                i === index ? { ...p, ...clampOverlay(overlay) } : p,
              );
              updatePageSlots(next);
            }}
            onAddRect={handleAddRect}
            preciseOverlayDraw
          />
        )}
      </div>
    </div>
  );
}
