import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import type { PracticeExamPage } from "@/lib/practiceExamTypes";
import { cn } from "@/lib/utils";
import { Loader2, Scissors } from "lucide-react";

type QuestionImportFigureEditorProps = {
  label: string;
  pages: PracticeExamPage[];
  imagePageNumber?: number;
  imageDataUrl?: string;
  sourceImageDataUrl?: string;
  cropping?: boolean;
  crop?: CropRect;
  cropBusy?: boolean;
  onSelectPage: (pageNumber: number) => void;
  onStartCrop: () => void;
  onCropChange: (crop: CropRect) => void;
  onApplyCrop: (crop: CropRect) => void;
  onCancelCrop: () => void;
  onClear?: () => void;
  compact?: boolean;
};

export function QuestionImportFigureEditor({
  label,
  pages,
  imagePageNumber,
  imageDataUrl,
  sourceImageDataUrl,
  cropping = false,
  crop = FULL_CROP,
  cropBusy = false,
  onSelectPage,
  onStartCrop,
  onCropChange,
  onApplyCrop,
  onCancelCrop,
  onClear,
  compact = false,
}: QuestionImportFigureEditorProps) {
  const hasImage = Boolean(imageDataUrl?.trim());

  return (
    <div
      className={cn(
        "rounded-lg border border-black/10 bg-[#fafbfc] p-3",
        compact && "p-2",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Label className="text-xs font-semibold text-foreground">{label}</Label>
        {hasImage && onClear ? (
          <button
            type="button"
            className="text-[10px] text-muted-foreground underline"
            onClick={onClear}
          >
            Clear image
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-[8rem] flex-1 space-y-1">
          <Label className="text-[10px] text-muted-foreground">PDF page</Label>
          <Select
            value={imagePageNumber ? String(imagePageNumber) : ""}
            onValueChange={(v) => v && onSelectPage(Number(v))}
            disabled={!pages.length || cropping}
          >
            <SelectTrigger className="h-8 bg-white text-xs">
              <SelectValue placeholder="Select page…" />
            </SelectTrigger>
            <SelectContent>
              {pages.map((p) => (
                <SelectItem key={p.pageNumber} value={String(p.pageNumber)}>
                  Page {p.pageNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {hasImage && !cropping ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onStartCrop}
            disabled={!sourceImageDataUrl && !imageDataUrl}
          >
            <Scissors className="size-3" />
            Crop
          </Button>
        ) : null}
      </div>

      {hasImage && !cropping ? (
        <img
          src={imageDataUrl}
          alt=""
          className={cn(
            "mt-2 rounded-md border border-black/10 bg-white object-contain",
            compact ? "max-h-24 w-full" : "max-h-40 w-full",
          )}
        />
      ) : null}

      {cropping && (sourceImageDataUrl ?? imageDataUrl) ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Drag a box around the figure for this {compact ? "subpart" : "question"}.
          </p>
          <PdfPageCropEditor
            imageDataUrl={sourceImageDataUrl ?? imageDataUrl!}
            crop={crop}
            onCropChange={onCropChange}
            onApply={() => onApplyCrop(crop)}
            onCancel={onCancelCrop}
          />
          {cropBusy ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Applying crop…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
