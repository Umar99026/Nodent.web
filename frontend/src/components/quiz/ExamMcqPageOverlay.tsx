import { useMemo, useRef, useState } from "react";
import { resolveQuestionImageSrc } from "@/lib/practiceQuestions";
import type { OverlayRect } from "@/lib/diagramLabels";
import type { McqOptionLetter, PracticeExamMcqItem } from "@/lib/practiceExamTypes";
import { MCQ_OPTION_LETTERS } from "@/lib/practiceExamTypes";
import {
  clampMcqButtonRect,
  clampMcqGroupBounds,
  finalizeMcqButtonPlacement,
  flattenMcqOverlays,
  getMcqButtonSizePct,
  getMcqGroupBounds,
  inferMcqGroupLayout,
  layoutMcqGroupInBounds,
  mcqBoundsFromPoints,
  mcqButtonDisplayRect,
  mcqButtonRectAtCenter,
  mcqPlacementCount,
  sortMcqItemsByQuestion,
  type McqOverlayRef,
} from "@/lib/practiceExamMcq";
import { normalizeMcqLetter } from "@/lib/practiceExamImport";
import { cn } from "@/lib/utils";

function pointerToPercent(clientX: number, clientY: number, rect: DOMRect) {
  return {
    x: Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100),
    y: Math.min(Math.max(((clientY - rect.top) / rect.height) * 100, 0), 100),
  };
}

function overlayKey(ref: McqOverlayRef): string {
  return `${ref.itemId}:${ref.letter}`;
}

function McqLetterCover() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 size-[168%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.06)]"
    />
  );
}

function showMcqLetterCover(
  editorMode: boolean,
  hidePdfLetters: boolean | undefined,
  item: PracticeExamMcqItem | undefined,
  letter: McqOptionLetter,
  armed: McqOverlayRef | null,
): boolean {
  if (!editorMode) return true;
  if (!item) return Boolean(hidePdfLetters);
  const separated = Boolean(item.mcqButtonsSeparated);
  const placingThisQuestion = armed?.itemId === item.id;
  if (placingThisQuestion) {
    if (separated) return armed.letter !== letter;
    return false;
  }
  return Boolean(hidePdfLetters) || separated;
}

type BoxDrag = {
  itemId: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origBounds: OverlayRect;
};

type ButtonDrag = {
  itemId: string;
  letter: McqOptionLetter;
  startX: number;
  startY: number;
  origRect: OverlayRect;
};

export type ExamMcqPageOverlayProps = {
  imageUrl: string;
  items: PracticeExamMcqItem[];
  answers?: Record<string, string>;
  onSelect?: (itemId: string, letter: McqOptionLetter) => void;
  disabled?: boolean;
  submitted?: boolean;
  results?: Record<string, boolean>;
  editorMode?: boolean;
  armed?: McqOverlayRef | null;
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string | null) => void;
  onPlaceOverlay?: (ref: McqOverlayRef, rect: OverlayRect) => void;
  onMoveMcqGroup?: (itemId: string, bounds: OverlayRect) => void;
  onResizeMcqGroup?: (itemId: string, bounds: OverlayRect) => void;
  onMoveMcqButton?: (
    itemId: string,
    letter: McqOptionLetter,
    rect: OverlayRect,
  ) => void;
  /** Admin: highlight the keyed correct letter in green. */
  showAnswerKey?: boolean;
  /** Cover printed A–D on the PDF behind each button (default: on for students, off in editor). */
  hidePdfLetters?: boolean;
};

export function ExamMcqPageOverlay({
  imageUrl,
  items,
  answers = {},
  onSelect,
  disabled = false,
  submitted = false,
  results = {},
  editorMode = false,
  armed = null,
  selectedItemId = null,
  onSelectItem,
  onPlaceOverlay,
  onMoveMcqGroup,
  onResizeMcqGroup,
  onMoveMcqButton,
  showAnswerKey = false,
  hidePdfLetters,
}: ExamMcqPageOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawRef = useRef<{ startX: number; startY: number } | null>(null);
  const boxDragRef = useRef<BoxDrag | null>(null);
  const buttonDragRef = useRef<ButtonDrag | null>(null);
  const [drawDraft, setDrawDraft] = useState<OverlayRect | null>(null);
  const [groupDragDraft, setGroupDragDraft] = useState<{
    itemId: string;
    bounds: OverlayRect;
    optionOverlays: ReturnType<typeof layoutMcqGroupInBounds>;
  } | null>(null);

  const captureContainerPointer = (e: React.PointerEvent) => {
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const sortedItems = useMemo(() => sortMcqItemsByQuestion(items), [items]);
  const overlays = flattenMcqOverlays(sortedItems);
  const src = resolveQuestionImageSrc(imageUrl);
  const armedItem = armed ? sortedItems.find((i) => i.id === armed.itemId) : null;
  const isSeparatedPlace = Boolean(armedItem?.mcqButtonsSeparated);

  const drawPreview = useMemo(() => {
    if (!drawDraft) return null;
    if (isSeparatedPlace && armed) {
      return {
        [armed.letter]: finalizeMcqButtonPlacement(drawDraft),
      } as Partial<Record<McqOptionLetter, OverlayRect>>;
    }
    return layoutMcqGroupInBounds(
      drawDraft,
      undefined,
      armedItem ? getMcqButtonSizePct(armedItem) : undefined,
    );
  }, [drawDraft, isSeparatedPlace, armed]);

  const groupItems = sortedItems.filter(
    (item) => mcqPlacementCount(item) === 4 && !item.mcqButtonsSeparated,
  );

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!editorMode || !onPlaceOverlay || !armed || !containerRef.current) return;
    if ((e.target as HTMLElement).closest("[data-mcq-group]")) return;
    if ((e.target as HTMLElement).closest("[data-mcq-button]")) return;
    const rect = containerRef.current.getBoundingClientRect();
    const start = pointerToPercent(e.clientX, e.clientY, rect);
    drawRef.current = { startX: start.x, startY: start.y };
    setDrawDraft({ overlayX: start.x, overlayY: start.y, overlayW: 0, overlayH: 0 });
    onSelectItem?.(armed.itemId);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const draw = drawRef.current;
    if (draw && onPlaceOverlay && armed) {
      const current = pointerToPercent(e.clientX, e.clientY, rect);
      setDrawDraft(
        mcqBoundsFromPoints(
          { x: draw.startX, y: draw.startY },
          { x: current.x, y: current.y },
        ),
      );
      return;
    }

    const btnDrag = buttonDragRef.current;
    if (btnDrag && onMoveMcqButton) {
      const dx = ((e.clientX - btnDrag.startX) / rect.width) * 100;
      const dy = ((e.clientY - btnDrag.startY) / rect.height) * 100;
      const orig = btnDrag.origRect;
      onMoveMcqButton(
        btnDrag.itemId,
        btnDrag.letter,
        finalizeMcqButtonPlacement({
          ...orig,
          overlayX: orig.overlayX + dx,
          overlayY: orig.overlayY + dy,
        }),
      );
      return;
    }

    const drag = boxDragRef.current;
    if (!drag) return;

    if (drag.mode === "move") {
      if (!onMoveMcqGroup) return;
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;
      const nextBounds = clampMcqGroupBounds({
        ...drag.origBounds,
        overlayX: drag.origBounds.overlayX + dx,
        overlayY: drag.origBounds.overlayY + dy,
      });
      const dragItem = sortedItems.find((i) => i.id === drag.itemId);
      const layout =
        dragItem?.mcqGroupLayout ?? inferMcqGroupLayout(nextBounds);
      const buttonSize = dragItem ? getMcqButtonSizePct(dragItem) : undefined;
      setGroupDragDraft({
        itemId: drag.itemId,
        bounds: nextBounds,
        optionOverlays: layoutMcqGroupInBounds(nextBounds, layout, buttonSize),
      });
      onMoveMcqGroup(drag.itemId, nextBounds);
      return;
    }

    if (!onResizeMcqGroup) return;
    const current = pointerToPercent(e.clientX, e.clientY, rect);
    const nextBounds = mcqBoundsFromPoints(
      { x: drag.origBounds.overlayX, y: drag.origBounds.overlayY },
      { x: current.x, y: current.y },
    );
    const dragItem = sortedItems.find((i) => i.id === drag.itemId);
    const layout = dragItem?.mcqGroupLayout ?? inferMcqGroupLayout(nextBounds);
    const buttonSize = dragItem ? getMcqButtonSizePct(dragItem) : undefined;
    setGroupDragDraft({
      itemId: drag.itemId,
      bounds: nextBounds,
      optionOverlays: layoutMcqGroupInBounds(nextBounds, layout, buttonSize),
    });
    onResizeMcqGroup(drag.itemId, nextBounds);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const draw = drawRef.current;
    if (draw && onPlaceOverlay && armed && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const end = pointerToPercent(e.clientX, e.clientY, rect);
      if (isSeparatedPlace) {
        onPlaceOverlay(armed, mcqButtonRectAtCenter(end.x, end.y));
      } else {
        const bounds = mcqBoundsFromPoints(
          { x: draw.startX, y: draw.startY },
          { x: end.x, y: end.y },
        );
        onPlaceOverlay(armed, bounds);
      }
    }
    drawRef.current = null;
    setDrawDraft(null);
    boxDragRef.current = null;
    buttonDragRef.current = null;
    setGroupDragDraft(null);
  };

  const startBoxDrag = (
    e: React.PointerEvent,
    itemId: string,
    mode: BoxDrag["mode"],
    bounds: OverlayRect,
  ) => {
    if (!editorMode || (!onMoveMcqGroup && !onResizeMcqGroup)) return;
    e.stopPropagation();
    e.preventDefault();
    onSelectItem?.(itemId);
    boxDragRef.current = {
      itemId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origBounds: bounds,
    };
    captureContainerPointer(e);
  };

  const startButtonDrag = (
    e: React.PointerEvent,
    ref: McqOverlayRef,
    item: PracticeExamMcqItem,
    rect: OverlayRect,
  ) => {
    if (!editorMode || !onMoveMcqButton || !item.mcqButtonsSeparated) return;
    e.stopPropagation();
    onSelectItem?.(ref.itemId);
    buttonDragRef.current = {
      itemId: ref.itemId,
      letter: ref.letter,
      startX: e.clientX,
      startY: e.clientY,
      origRect: clampMcqButtonRect(rect),
    };
    captureContainerPointer(e);
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-black/10 bg-[#f3f4f6]",
        editorMode && armed && onPlaceOverlay && "cursor-crosshair select-none",
      )}
      onPointerDown={editorMode && armed ? handleCanvasPointerDown : undefined}
      onPointerMove={editorMode ? handlePointerMove : undefined}
      onPointerUp={editorMode ? handlePointerUp : undefined}
      onPointerLeave={editorMode ? handlePointerUp : undefined}
    >
      <img
        src={src}
        alt="Exam page"
        className="pointer-events-none block w-full select-none object-contain"
        draggable={false}
        decoding="async"
      />

      {editorMode && drawDraft ? (
        <>
          {!isSeparatedPlace ? (
            <div
              className="pointer-events-none absolute rounded border-2 border-dashed border-brand bg-brand/5"
              style={{
                left: `${drawDraft.overlayX}%`,
                top: `${drawDraft.overlayY}%`,
                width: `${drawDraft.overlayW}%`,
                height: `${drawDraft.overlayH}%`,
              }}
            />
          ) : null}
          {MCQ_OPTION_LETTERS.map((letter) => {
            const preview = drawPreview?.[letter];
            if (!preview) return null;
            const display = mcqButtonDisplayRect(preview);
            const isArmedLetter = armed?.letter === letter;
            const previewCover = showMcqLetterCover(
              editorMode,
              hidePdfLetters,
              armedItem ?? undefined,
              letter,
              armed,
            );
            return (
              <div
                key={`preview-${letter}`}
                className="pointer-events-none absolute"
                style={{
                  left: `${display.overlayX}%`,
                  top: `${display.overlayY}%`,
                  width: `${display.overlayW}%`,
                  height: `${display.overlayH}%`,
                }}
              >
                {previewCover ? <McqLetterCover /> : null}
                <div
                  className={cn(
                    "relative z-10 flex aspect-square h-full max-h-full w-full max-w-full items-center justify-center rounded-full border-2 border-dashed text-[9px] font-semibold",
                    isArmedLetter
                      ? "border-brand bg-white text-brand shadow-sm"
                      : "border-brand/60 bg-white/95 text-brand",
                  )}
                >
                  {letter}
                </div>
              </div>
            );
          })}
        </>
      ) : null}

      {editorMode
        ? groupItems.map((item) => {
            const bounds =
              groupDragDraft?.itemId === item.id
                ? groupDragDraft.bounds
                : getMcqGroupBounds(item);
            if (!bounds) return null;
            const isSelected = selectedItemId === item.id;
            return (
              <div
                key={`group-${item.id}`}
                data-mcq-group
                className={cn(
                  "absolute cursor-move rounded border-2 bg-brand/5",
                  isSelected ? "border-brand" : "border-brand/50",
                )}
                style={{
                  left: `${bounds.overlayX}%`,
                  top: `${bounds.overlayY}%`,
                  width: `${bounds.overlayW}%`,
                  height: `${bounds.overlayH}%`,
                  zIndex: isSelected ? 80 + item.questionNumber : 10 + item.questionNumber,
                }}
                onPointerDown={(e) => startBoxDrag(e, item.id, "move", bounds)}
              >
                <span className="pointer-events-none absolute -top-4 left-0 rounded bg-brand px-1 py-0.5 text-[9px] font-bold text-white">
                  Q{item.questionNumber}
                </span>
                <div
                  className="pointer-events-auto absolute bottom-0 right-0 z-20 size-4 translate-x-1/2 translate-y-1/2 cursor-se-resize rounded-sm border-2 border-brand bg-white shadow-md"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    startBoxDrag(e, item.id, "resize", bounds);
                  }}
                />
              </div>
            );
          })
        : null}

      {overlays.map(({ itemId, letter, rect: storedRect }) => {
        const key = overlayKey({ itemId, letter });
        const item = sortedItems.find((i) => i.id === itemId);
        const separated = Boolean(item?.mcqButtonsSeparated);
        const draftOverlays =
          groupDragDraft?.itemId === itemId && !separated
            ? groupDragDraft.optionOverlays
            : null;
        const rect = draftOverlays?.[letter] ?? storedRect;
        if (!rect) return null;
        const display = mcqButtonDisplayRect(rect);
        const selectedLetter = (answers[itemId] ?? "").toUpperCase();
        const isChosen = selectedLetter === letter;
        const result = submitted ? results[itemId] : null;
        const showResult = submitted && !editorMode && result != null;
        const isAnswerKey =
          showAnswerKey && normalizeMcqLetter(item?.acceptedAnswer ?? "") === letter;
        const isArmed = armed?.itemId === itemId && armed.letter === letter;
        const showCover = showMcqLetterCover(
          editorMode,
          hidePdfLetters,
          item,
          letter,
          armed,
        );
        const isSelected = editorMode && selectedItemId === itemId;

        return (
          <div
            key={key}
            data-mcq-button
            data-mcq-separated={separated || undefined}
            className={cn(
              "absolute flex items-center justify-center",
              !editorMode && "cursor-pointer",
              editorMode && separated && "cursor-grab active:cursor-grabbing",
            )}
            style={{
              left: `${display.overlayX}%`,
              top: `${display.overlayY}%`,
              width: `${display.overlayW}%`,
              height: `${display.overlayH}%`,
              zIndex: 20 + (item?.questionNumber ?? 0) + (isAnswerKey ? 100 : 0),
              pointerEvents:
                groupDragDraft?.itemId === itemId && !separated ? "none" : undefined,
            }}
            onPointerDown={(e) => {
              if (item) startButtonDrag(e, { itemId, letter }, item, rect);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (editorMode) return;
              if (!disabled && !submitted) onSelect?.(itemId, letter);
            }}
          >
            {showCover ? <McqLetterCover /> : null}
            {editorMode && separated && isSelected ? (
              <span className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-brand px-1 py-px text-[8px] font-bold text-white">
                Q{item?.questionNumber}
              </span>
            ) : null}
            <button
              type="button"
              disabled={disabled || submitted || (editorMode && !separated)}
              aria-label={`Question option ${letter}`}
              aria-pressed={isChosen}
              className={cn(
                "relative z-10 aspect-square h-full max-h-full w-full max-w-full min-w-0 min-h-0",
                "flex items-center justify-center rounded-full border-2 font-semibold leading-none",
                "text-[clamp(9px,62%,13px)] transition-[transform,box-shadow,border-color,background-color] duration-150",
                "shadow-[0_1px_3px_rgba(11,15,25,0.12)]",
                showCover ? "bg-white text-[#0b0f19]" : "bg-white/95 text-[#0b0f19]",
                editorMode && !separated && "pointer-events-none",
                editorMode && separated && isSelected && "ring-2 ring-brand/35",
                editorMode && isArmed && "ring-2 ring-brand ring-offset-1",
                editorMode &&
                  isAnswerKey &&
                  "border-success bg-success text-white shadow-[0_2px_8px_rgba(34,197,94,0.35)] ring-2 ring-success ring-offset-2",
                editorMode && !isAnswerKey && "border-[#0b0f19]/20",
                !editorMode &&
                  !submitted &&
                  !isChosen &&
                  "border-[#0b0f19]/18 hover:scale-[1.06] hover:border-brand hover:shadow-[0_2px_8px_rgba(86,171,230,0.28)] active:scale-100",
                !editorMode && isChosen && !submitted && "border-brand bg-brand text-white shadow-[0_2px_8px_rgba(86,171,230,0.35)]",
                showResult &&
                  isChosen &&
                  result === true &&
                  "border-success bg-success text-white shadow-[0_2px_8px_rgba(34,197,94,0.3)]",
                showResult &&
                  isChosen &&
                  result === false &&
                  "border-danger bg-danger text-white shadow-[0_2px_8px_rgba(239,68,68,0.3)]",
              )}
            >
              {letter}
            </button>
          </div>
        );
      })}
    </div>
  );
}
