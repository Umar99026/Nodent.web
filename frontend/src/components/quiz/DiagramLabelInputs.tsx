import { useEffect, useRef, useState } from "react";
import { resolveQuestionImageSrc } from "@/lib/practiceQuestions";
import { HandwritingCanvas } from "@/components/quiz/HandwritingCanvas";
import { ExamPaperRuledField } from "@/components/quiz/ExamPaperRuledField";
import { QuizAnswerField } from "@/components/quiz/QuizAnswerField";
import { useHandwritingModeActive } from "@/context/HandwritingModeContext";
import {
  clampOverlay,
  finalizeDrawnOverlay,
  finalizePreciseOverlay,
  normalizeStoredOverlay,
  overlayRectFromPoints,
  resizeOverlayFromHandle,
  type DiagramLabelPart,
  type OverlayRect,
  type OverlayResizeHandle,
  partHasOverlay,
} from "@/lib/diagramLabels";
import { overlayMinLinesFromHeight } from "@/lib/examPaperInputLines";
import { cn } from "@/lib/utils";

export type DiagramLabelInputsProps = {
  imageUrl: string;
  parts: DiagramLabelPart[];
  values?: string[];
  onChange?: (index: number, value: string) => void;
  disabled?: boolean;
  submitted?: boolean;
  partResults?: (boolean | null)[];
  /** Editor: highlight + interact with boxes on the image */
  editorMode?: boolean;
  /** Past-exam paper: dotted boxes, no labels/placeholders on inputs */
  examPaperMode?: boolean;
  selectedIndex?: number | null;
  onSelectIndex?: (index: number | null) => void;
  onMovePart?: (index: number, overlay: OverlayRect) => void;
  onResizePart?: (index: number, overlay: OverlayRect) => void;
  /** Drag on empty canvas to draw a new box (crop-style). */
  onAddRect?: (rect: OverlayRect) => void;
  /** Keep drawn overlay size on release (practice exam PDF editor). */
  preciseOverlayDraw?: boolean;
  subjectId?: string;
};

const RESIZE_HANDLES: {
  handle: OverlayResizeHandle;
  className: string;
  cursor: string;
}[] = [
  { handle: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-nwse-resize" },
  { handle: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ns-resize" },
  { handle: "ne", className: "right-0 top-0 translate-x-1/2 -translate-y-1/2", cursor: "cursor-nesw-resize" },
  { handle: "e", className: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { handle: "se", className: "right-0 bottom-0 translate-x-1/2 translate-y-1/2", cursor: "cursor-nwse-resize" },
  { handle: "s", className: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-ns-resize" },
  { handle: "sw", className: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2", cursor: "cursor-nesw-resize" },
  { handle: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
];

function pointerToPercent(clientX: number, clientY: number, rect: DOMRect) {
  return {
    x: Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100),
    y: Math.min(Math.max(((clientY - rect.top) / rect.height) * 100, 0), 100),
  };
}

function examPaperShellClass(
  transparentInput: boolean,
  extra?: string,
  editorMode = false,
): string {
  return cn(
    "exam-paper-input-shell",
    transparentInput
      ? cn(
          "exam-paper-input-shell--transparent",
          editorMode && "exam-paper-input-shell--editor-transparent",
        )
      : "exam-paper-input-shell--filled",
    extra,
  );
}

export function DiagramLabelInputs({
  imageUrl,
  parts,
  values = [],
  onChange,
  disabled = false,
  submitted = false,
  partResults = [],
  editorMode = false,
  examPaperMode = false,
  selectedIndex = null,
  onSelectIndex,
  onMovePart,
  onResizePart,
  onAddRect,
  preciseOverlayDraw = false,
  subjectId,
}: DiagramLabelInputsProps) {
  const handwritingMode = useHandwritingModeActive(subjectId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    index: number;
    startX: number;
    startY: number;
    orig: OverlayRect;
  } | null>(null);
  const resizeRef = useRef<{
    index: number;
    handle: OverlayResizeHandle;
    startX: number;
    startY: number;
    orig: OverlayRect;
  } | null>(null);
  const drawRef = useRef<{ startX: number; startY: number } | null>(null);
  const [drawDraft, setDrawDraft] = useState<OverlayRect | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const src = resolveQuestionImageSrc(imageUrl);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const syncHeight = () => setContainerHeight(el.getBoundingClientRect().height);
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [imageUrl, src]);

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    if (!editorMode || !onMovePart) return;
    if ((e.target as HTMLElement).closest("[data-resize-handle]")) return;
    e.stopPropagation();
    onSelectIndex?.(index);
    const part = parts[index];
    if (!part || !partHasOverlay(part)) return;
    dragRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      orig: clampOverlay(part),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (
    e: React.PointerEvent,
    index: number,
    handle: OverlayResizeHandle,
  ) => {
    if (!editorMode || !onResizePart) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectIndex?.(index);
    const part = parts[index];
    if (!part || !partHasOverlay(part)) return;
    resizeRef.current = {
      index,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: clampOverlay(part),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!editorMode || !onAddRect || !containerRef.current) return;
    if ((e.target as HTMLElement).closest("[data-label-box]")) return;
    const rect = containerRef.current.getBoundingClientRect();
    const start = pointerToPercent(e.clientX, e.clientY, rect);
    drawRef.current = { startX: start.x, startY: start.y };
    setDrawDraft({ overlayX: start.x, overlayY: start.y, overlayW: 0, overlayH: 0 });
    onSelectIndex?.(null);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const draw = drawRef.current;
    if (draw && onAddRect) {
      const current = pointerToPercent(e.clientX, e.clientY, rect);
      setDrawDraft(
        overlayRectFromPoints(
          { x: draw.startX, y: draw.startY },
          { x: current.x, y: current.y },
        ),
      );
      return;
    }

    const resize = resizeRef.current;
    if (resize && onResizePart) {
      const dx = ((e.clientX - resize.startX) / rect.width) * 100;
      const dy = ((e.clientY - resize.startY) / rect.height) * 100;
      onResizePart(
        resize.index,
        resizeOverlayFromHandle(resize.handle, resize.orig, dx, dy),
      );
      return;
    }

    const drag = dragRef.current;
    if (!drag || !onMovePart) return;
    const dx = ((e.clientX - drag.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startY) / rect.height) * 100;
    onMovePart(
      drag.index,
      clampOverlay({
        overlayX: drag.orig.overlayX + dx,
        overlayY: drag.orig.overlayY + dy,
        overlayW: drag.orig.overlayW,
        overlayH: drag.orig.overlayH,
      }),
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const draw = drawRef.current;
    if (draw && onAddRect && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const end = pointerToPercent(e.clientX, e.clientY, rect);
      const finalize = preciseOverlayDraw ? finalizePreciseOverlay : finalizeDrawnOverlay;
      const final = finalize(
        overlayRectFromPoints(
          { x: draw.startX, y: draw.startY },
          { x: end.x, y: end.y },
        ),
      );
      onAddRect(final);
    }

    drawRef.current = null;
    setDrawDraft(null);
    dragRef.current = null;
    resizeRef.current = null;
  };

  const labeledParts = parts
    .map((part, idx) => ({ part, idx }))
    .filter(({ part }) => partHasOverlay(part));

  if (handwritingMode && !editorMode) {
    return (
      <div className="space-y-4">
        <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-black/10 bg-[#f3f4f6]">
          <img
            src={src}
            alt="Diagram to label"
            className="block w-full select-none object-contain"
            draggable={false}
            decoding="async"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {labeledParts.map(({ part, idx }) => {
            const result = partResults[idx];
            const showResult = submitted && result != null;
            return (
              <HandwritingCanvas
                key={`${part.key}-${idx}`}
                value={values[idx] ?? ""}
                onChange={(value) => onChange?.(idx, value)}
                disabled={disabled}
                size="md"
                label={part.label?.trim() || `Label ${idx + 1}`}
                className={cn(
                  showResult && result === true && "rounded-lg ring-2 ring-success/40",
                  showResult && result === false && "rounded-lg ring-2 ring-danger/40",
                )}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-black/10 bg-[#f3f4f6]",
        editorMode && onAddRect && "cursor-crosshair select-none",
      )}
      onPointerDown={editorMode && onAddRect ? handleCanvasPointerDown : undefined}
      onPointerMove={editorMode && onAddRect ? handlePointerMove : undefined}
      onPointerUp={editorMode && onAddRect ? handlePointerUp : undefined}
      onPointerLeave={editorMode && onAddRect ? handlePointerUp : undefined}
    >
      <img
        src={src}
        alt="Diagram to label"
        className="pointer-events-none block w-full select-none object-contain"
        draggable={false}
        decoding="async"
      />

      {editorMode && drawDraft && (drawDraft.overlayW > 0.5 || drawDraft.overlayH > 0.5) ? (
        <div
          className="pointer-events-none absolute border-2 border-brand bg-brand/15"
          style={{
            left: `${drawDraft.overlayX}%`,
            top: `${drawDraft.overlayY}%`,
            width: `${drawDraft.overlayW}%`,
            height: `${drawDraft.overlayH}%`,
          }}
        />
      ) : null}

      {parts.map((part, idx) => {
        if (!partHasOverlay(part)) return null;
        const { overlayX, overlayY, overlayW, overlayH } =
          editorMode
            ? {
                overlayX: part.overlayX ?? 0,
                overlayY: part.overlayY ?? 0,
                overlayW: part.overlayW ?? 0,
                overlayH: part.overlayH ?? 0,
              }
            : examPaperMode
              ? clampOverlay({
                  overlayX: part.overlayX ?? 0,
                  overlayY: part.overlayY ?? 0,
                  overlayW: part.overlayW ?? 0,
                  overlayH: part.overlayH ?? 0,
                })
              : normalizeStoredOverlay({
                  overlayX: part.overlayX ?? 0,
                  overlayY: part.overlayY ?? 0,
                  overlayW: part.overlayW ?? 0,
                  overlayH: part.overlayH ?? 0,
                });
        const selected = editorMode && selectedIndex === idx;
        const result = partResults[idx];
        const showResult = submitted && !editorMode && result != null;
        const transparentInput = !!part.transparentInput;
        const overlayMinLines = overlayMinLinesFromHeight(overlayH, containerHeight);

        return (
          <div
            key={`${part.key}-${idx}`}
            data-label-box
            className={cn(
              "absolute",
              editorMode && "cursor-grab active:cursor-grabbing",
            )}
            style={{
              left: `${overlayX}%`,
              top: `${overlayY}%`,
              width: `${overlayW}%`,
              height: `${overlayH}%`,
            }}
            onPointerDown={(e) => handlePointerDown(e, idx)}
            onClick={(e) => {
              e.stopPropagation();
              onSelectIndex?.(idx);
            }}
          >
            {editorMode ? (
              <>
                <div
                  className={
                    examPaperMode
                      ? examPaperShellClass(
                          transparentInput,
                          selected ? "ring-2 ring-brand/40" : undefined,
                          true,
                        )
                      : cn(
                          "flex h-full w-full items-center justify-center rounded border-2 bg-white/90 px-1 text-[10px] font-semibold shadow-sm",
                          selected ? "border-brand ring-2 ring-brand/25" : "border-brand/50 border-dashed",
                        )
                  }
                >
                  {examPaperMode && !transparentInput ? (
                    <div className="exam-paper-input-ruling" aria-hidden="true" />
                  ) : null}
                </div>
                {selected && onResizePart
                  ? RESIZE_HANDLES.map(({ handle, className, cursor }) => (
                      <button
                        key={handle}
                        type="button"
                        data-resize-handle
                        aria-label={`Resize ${handle}`}
                        className={cn(
                          "absolute z-10 size-3 rounded-sm border-2 border-white bg-brand shadow-sm",
                          className,
                          cursor,
                        )}
                        onPointerDown={(e) => handleResizePointerDown(e, idx, handle)}
                      />
                    ))
                  : null}
              </>
            ) : examPaperMode ? (
              <ExamPaperRuledField
                value={values[idx] ?? ""}
                onChange={(value) => onChange?.(idx, value)}
                disabled={disabled}
                minLines={overlayMinLines}
                variant="overlay"
                transparentInput={transparentInput}
                shellClassName={cn(
                  "h-full",
                  !transparentInput &&
                    showResult &&
                    result === true &&
                    "border-success bg-success/10",
                  !transparentInput &&
                    showResult &&
                    result === false &&
                    "border-danger bg-danger/10",
                )}
              />
            ) : (
              <QuizAnswerField
                value={values[idx] ?? ""}
                onChange={(value) => onChange?.(idx, value)}
                placeholder={part.placeholder?.trim() || "…"}
                disabled={disabled}
                handwritingSize="sm"
                subjectId={subjectId}
                className={cn(
                  "h-full min-h-7 w-full px-1.5 text-xs shadow-none sm:text-sm",
                  "border-black/20 bg-white/95",
                  showResult && result === true && "border-success bg-success/10",
                  showResult && result === false && "border-danger bg-danger/10",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
