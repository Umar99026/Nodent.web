import { useCallback, useEffect, useRef, useState } from "react";
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { type CropRect } from "@/lib/pdfImageCrop";
import type { PdfPageView } from "@/lib/createPdfPageView";
import { MousePointer2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

export type PdfViewerTool = "select" | "crop";

type CreatePdfPageViewerProps = {
  page: PdfPageView;
  tool: PdfViewerTool;
  onToolChange: (tool: PdfViewerTool) => void;
  crop: CropRect;
  onCropChange: (crop: CropRect) => void;
  onApplyCrop: (cropped: string) => void;
  onCancelCrop: () => void;
};

export function getSelectedTextFromViewer(container: HTMLElement | null): string {
  if (!container) return "";
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return "";
  const range = sel.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return "";
  return sel.toString().replace(/\s+/g, " ").trim();
}

export function CreatePdfPageViewer({
  page,
  tool,
  onToolChange,
  crop,
  onCropChange,
  onApplyCrop,
  onCancelCrop,
}: CreatePdfPageViewerProps) {
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [selectionHint, setSelectionHint] = useState("");

  const refreshSelectionHint = useCallback(() => {
    const text = getSelectedTextFromViewer(textLayerRef.current);
    setSelectionHint(text ? `${text.length} characters selected` : "");
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshSelectionHint);
    return () => document.removeEventListener("selectionchange", refreshSelectionHint);
  }, [refreshSelectionHint]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-black/10 bg-white p-0.5">
          <button
            type="button"
            onClick={() => onToolChange("select")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tool === "select"
                ? "bg-[#0b0f19] text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MousePointer2 className="size-3.5" />
            Select text
          </button>
          <button
            type="button"
            onClick={() => onToolChange("crop")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tool === "crop"
                ? "bg-[#0b0f19] text-white"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Scissors className="size-3.5" />
            Crop region
          </button>
        </div>
        {tool === "select" ? (
          <span className="text-xs text-muted-foreground">
            {selectionHint || "Drag to highlight text on the page"}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Drag a box around a diagram or table, then assign it on the right
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-black/10 bg-[#eef1f5] p-2 sm:p-3">
        {tool === "crop" ? (
          <PdfPageCropEditor
            imageDataUrl={page.imageDataUrl}
            crop={crop}
            onCropChange={onCropChange}
            onApply={onApplyCrop}
            onCancel={onCancelCrop}
          />
        ) : (
          <div className="relative mx-auto w-full max-w-4xl shadow-md">
            <img
              src={page.imageDataUrl}
              alt={`PDF page ${page.pageNumber}`}
              className="block w-full select-none"
              draggable={false}
            />
            {tool === "select" ? (
              <div
                ref={textLayerRef}
                className="absolute inset-0 select-text"
                aria-label="Selectable PDF text"
              >
                {page.textSpans.map((span, i) => (
                  <span
                    key={`${i}-${span.leftPct}-${span.topPct}`}
                    className="absolute whitespace-pre text-transparent"
                    style={{
                      left: `${span.leftPct}%`,
                      top: `${span.topPct}%`,
                      width: `${Math.max(span.widthPct, 1)}%`,
                      fontSize: `${Math.max(span.fontSizePx * 0.85, 8)}px`,
                      lineHeight: 1.1,
                    }}
                  >
                    {span.str}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
