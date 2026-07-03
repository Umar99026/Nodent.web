import { useEffect, useRef } from "react";
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { Button } from "@/components/ui/button";
import { type CropRect } from "@/lib/pdfImageCrop";
import type { PracticeExamPage } from "@/lib/practiceExamTypes";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type PdfImportScrollViewerProps = {
  pages: PracticeExamPage[];
  cropActive: boolean;
  cropTargetLabel: string | null;
  cropPageNumber: number | null;
  onSelectCropPage: (pageNumber: number) => void;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  onApplyCrop: (croppedDataUrl: string, pageNumber: number) => void;
  onCancelCrop: () => void;
};

export function PdfImportScrollViewer({
  pages,
  cropActive,
  cropTargetLabel,
  cropPageNumber,
  onSelectCropPage,
  crop,
  onCropChange,
  onApplyCrop,
  onCancelCrop,
}: PdfImportScrollViewerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!cropActive || cropPageNumber == null) return;
    const el = document.getElementById(`pdf-import-page-${cropPageNumber}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [cropActive, cropPageNumber]);

  if (!pages.length) {
    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        PDF pages will appear here after upload.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-2 border-b px-3 py-2.5 text-xs",
          cropActive ? "border-brand/25 bg-brand/5 text-[#0b0f19]" : "border-black/8 bg-muted/30 text-muted-foreground",
        )}
      >
        <p className="leading-relaxed">
          {cropActive && cropTargetLabel ? (
            <>
              <span className="font-semibold text-foreground">Cropping:</span> {cropTargetLabel}.
              Scroll to the right page, click it, then drag a box around the figure.
            </>
          ) : (
            <>Use &ldquo;Pick figure from PDF&rdquo; on a question, then crop from the pages below.</>
          )}
        </p>
        {cropActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-2 text-xs"
            onClick={onCancelCrop}
          >
            <X className="size-3.5" />
            Cancel
          </Button>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-[#eef1f5] p-2 sm:p-3">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {pages.map((page) => {
            const isCropPage = cropActive && cropPageNumber === page.pageNumber;
            return (
              <section
                key={page.pageNumber}
                id={`pdf-import-page-${page.pageNumber}`}
                className={cn(
                  "rounded-lg border bg-white shadow-sm transition-shadow",
                  isCropPage ? "border-brand ring-2 ring-brand/25" : "border-black/10",
                )}
              >
                <p className="border-b border-black/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Page {page.pageNumber}
                </p>
                {isCropPage ? (
                  <div className="p-2">
                    <PdfPageCropEditor
                      imageDataUrl={page.imageDataUrl}
                      crop={crop}
                      onCropChange={onCropChange}
                      onApply={(cropped) => onApplyCrop(cropped, page.pageNumber)}
                      onCancel={onCancelCrop}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!cropActive}
                    onClick={() => cropActive && onSelectCropPage(page.pageNumber)}
                    className={cn(
                      "block w-full p-1 text-left",
                      cropActive && "cursor-crosshair hover:bg-brand/[0.03]",
                      !cropActive && "cursor-default",
                    )}
                  >
                    <img
                      src={page.imageDataUrl}
                      alt={`PDF page ${page.pageNumber}`}
                      className="block w-full select-none"
                      draggable={false}
                    />
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
