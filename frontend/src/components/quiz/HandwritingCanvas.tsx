import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isHandwritingValue } from "@/lib/handwritingMode";
import { cn } from "@/lib/utils";

export type HandwritingSize = "sm" | "md" | "lg" | "xl";

/** Explicit pixel heights — avoids layout / resize feedback loops. */
const HEIGHT_PX: Record<HandwritingSize, number> = {
  sm: 160,
  md: 280,
  lg: 420,
  xl: 560,
};

/** Extra resolution on export so vision models can read thin strokes. */
const EXPORT_SUPERSAMPLE = 1.5;

const MAX_EXPORT_WIDTH = 1400;
const MAX_EXPORT_HEIGHT = 2000;
const EXPORT_JPEG_QUALITY = 0.9;

const DEFAULT_LINE_STEP = 32;
const DEFAULT_LINE_INSET = 12;
const EXAM_LINE_HEIGHT = 32;
const EXPORT_DEBOUNCE_MS = 150;

/** Custom eraser cursor (hotspot at the rubbing tip). */
const ERASER_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" stroke="#0b0f19" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M22 21H7" stroke="#0b0f19" stroke-width="1.75" stroke-linecap="round"/>
    <path d="m5 11 9 9" stroke="#0b0f19" stroke-width="1.75" stroke-linecap="round"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 8 26, cell`;
})();

type HandwritingCanvasProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: HandwritingSize;
  /** VCE booklet: dotted box, CSS ruling, taller pad */
  examPaperMode?: boolean;
  /** Ruled line count when examPaperMode (height = lines × 28px). */
  lines?: number;
  className?: string;
  label?: string;
};

function paintRuledLines(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  dpr: number,
) {
  const lineStep = DEFAULT_LINE_STEP;
  const lineInset = DEFAULT_LINE_INSET;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cssW, cssH);

  ctx.save();
  ctx.strokeStyle = "rgba(11, 15, 25, 0.42)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.lineCap = "round";

  for (let y = lineStep; y < cssH - 6; y += lineStep) {
    ctx.beginPath();
    ctx.moveTo(lineInset, y + 0.5);
    ctx.lineTo(cssW - lineInset, y + 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function paintExamExportRuling(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const lineStep = EXAM_LINE_HEIGHT * EXPORT_SUPERSAMPLE;

  ctx.save();
  ctx.strokeStyle = "rgba(11, 15, 25, 0.34)";
  ctx.lineWidth = EXPORT_SUPERSAMPLE;
  ctx.setLineDash([3 * EXPORT_SUPERSAMPLE, 7 * EXPORT_SUPERSAMPLE]);
  ctx.lineCap = "butt";

  for (let y = lineStep; y < height; y += lineStep) {
    ctx.beginPath();
    ctx.moveTo(0, y - 0.5);
    ctx.lineTo(width, y - 0.5);
    ctx.stroke();
  }

  ctx.restore();
}

function syncCanvasBuffer(canvas: HTMLCanvasElement, cssW: number, cssH: number) {
  const dpr = window.devicePixelRatio || 1;
  const bufferW = Math.max(1, Math.round(cssW * dpr));
  const bufferH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== bufferW || canvas.height !== bufferH) {
    canvas.width = bufferW;
    canvas.height = bufferH;
  }
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  return { bufferW, bufferH, dpr, cssW, cssH };
}

function canvasHasInk(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { width, height } = canvas;
  if (width < 1 || height < 1) return false;
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 16) {
    if (data[i]! > 8) return true;
  }
  return false;
}

/** Crop export to ink region (+ padding) so empty ruled lines don't bloat the image. */
function inkExportRegion(
  ink: HTMLCanvasElement,
  examPaperMode: boolean,
): { sx: number; sy: number; sw: number; sh: number } {
  const { width, height } = ink;
  const ctx = ink.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { sx: 0, sy: 0, sw: width, sh: height };

  const pad = Math.round(20 * (window.devicePixelRatio || 1));
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  const data = ctx.getImageData(0, 0, width, height).data;
  const step = 4;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const a = data[(y * width + x) * 4 + 3]!;
      if (a > 8) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }

  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  if (examPaperMode) {
    return {
      sx: 0,
      sy: minY,
      sw: width,
      sh: maxY - minY + 1,
    };
  }

  return {
    sx: minX,
    sy: minY,
    sw: maxX - minX + 1,
    sh: maxY - minY + 1,
  };
}

export function HandwritingCanvas({
  value,
  onChange,
  disabled = false,
  size = "md",
  examPaperMode = false,
  lines,
  className,
  label,
}: HandwritingCanvasProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const linesRef = useRef<HTMLCanvasElement | null>(null);
  const inkRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasInkRef = useRef(false);
  const lastSentValueRef = useRef(value);
  const exportTimerRef = useRef<number | null>(null);
  const ruledLines = examPaperMode
    ? Math.max(6, Math.min(24, Math.round(lines ?? 10)))
    : 0;
  const padHeight = examPaperMode
    ? ruledLines * EXAM_LINE_HEIGHT
    : HEIGHT_PX[size];
  const [eraserMode, setEraserMode] = useState(false);

  const getInkContext = () => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  };

  const layoutCanvases = useCallback(() => {
    if (drawingRef.current) return;

    const pad = padRef.current;
    const lines = linesRef.current;
    const ink = inkRef.current;
    if (!pad || !lines || !ink) return;

    const cssW = pad.clientWidth;
    const cssH = padHeight;
    if (cssW < 1) return;

    const inkSnapshot = document.createElement("canvas");
    if (ink.width > 0 && ink.height > 0 && hasInkRef.current) {
      inkSnapshot.width = ink.width;
      inkSnapshot.height = ink.height;
      inkSnapshot.getContext("2d")?.drawImage(ink, 0, 0);
    }

    const { cssW: w, cssH: h, dpr } = syncCanvasBuffer(lines, cssW, cssH);
    syncCanvasBuffer(ink, cssW, cssH);

    const linesCtx = lines.getContext("2d");
    if (linesCtx && !examPaperMode) paintRuledLines(linesCtx, w, h, dpr);

    const inkCtx = ink.getContext("2d");
    if (inkCtx) {
      inkCtx.clearRect(0, 0, ink.width, ink.height);
      if (inkSnapshot.width > 0) {
        inkCtx.drawImage(inkSnapshot, 0, 0, ink.width, ink.height);
      }
    }
  }, [padHeight, examPaperMode]);

  useEffect(() => {
    layoutCanvases();
    const pad = padRef.current;
    if (!pad) return;

    const observer = new ResizeObserver(() => layoutCanvases());
    observer.observe(pad);
    return () => observer.disconnect();
  }, [layoutCanvases, size]);

  useEffect(() => {
    if (value === lastSentValueRef.current) return;

    lastSentValueRef.current = value;
    const ink = inkRef.current;
    const inkCtx = ink?.getContext("2d");
    if (!ink || !inkCtx) return;

    layoutCanvases();

    if (!value) {
      inkCtx.clearRect(0, 0, ink.width, ink.height);
      hasInkRef.current = false;
      return;
    }

    if (!isHandwritingValue(value)) return;

    const img = new Image();
    img.onload = () => {
      inkCtx.clearRect(0, 0, ink.width, ink.height);
      inkCtx.drawImage(img, 0, 0, ink.width, ink.height);
      hasInkRef.current = true;
    };
    img.src = value;
  }, [value, layoutCanvases]);

  const canvasPoint = (clientX: number, clientY: number) => {
    const canvas = inkRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const plotDot = (x: number, y: number, erase: boolean) => {
    const ctx = getInkContext();
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    if (erase) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.beginPath();
      ctx.arc(x, y, Math.max(14, 8 * dpr), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      const r = Math.max(1.5, dpr * 1.25);
      ctx.fillStyle = "#0b0f19";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      hasInkRef.current = true;
    }
  };

  const plotLine = (x: number, y: number, erase: boolean) => {
    const ctx = getInkContext();
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const dpr = window.devicePixelRatio || 1;
    if (erase) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = Math.max(24, 12 * dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.strokeStyle = "#0b0f19";
      ctx.lineWidth = 2.5 * dpr;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      hasInkRef.current = true;
    }
    lastPointRef.current = { x, y };
  };

  const exportComposite = useCallback(() => {
    const lines = linesRef.current;
    const ink = inkRef.current;
    if (!lines || !ink || !hasInkRef.current) {
      lastSentValueRef.current = "";
      onChange("");
      return;
    }

    const { sx, sy, sw, sh } = inkExportRegion(ink, examPaperMode);
    let destW = Math.max(1, Math.round(sw * EXPORT_SUPERSAMPLE));
    let destH = Math.max(1, Math.round(sh * EXPORT_SUPERSAMPLE));
    const cap = Math.min(MAX_EXPORT_WIDTH / destW, MAX_EXPORT_HEIGHT / destH, 1);
    destW = Math.max(1, Math.round(destW * cap));
    destH = Math.max(1, Math.round(destH * cap));

    const temp = document.createElement("canvas");
    temp.width = destW;
    temp.height = destH;
    const ctx = temp.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, destW, destH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (examPaperMode) {
      paintExamExportRuling(ctx, destW, destH);
      ctx.drawImage(ink, sx, sy, sw, sh, 0, 0, destW, destH);
    } else {
      ctx.drawImage(lines, sx, sy, sw, sh, 0, 0, destW, destH);
      ctx.drawImage(ink, sx, sy, sw, sh, 0, 0, destW, destH);
    }

    const dataUrl = temp.toDataURL("image/jpeg", EXPORT_JPEG_QUALITY);
    lastSentValueRef.current = dataUrl;
    onChange(dataUrl);
  }, [examPaperMode, onChange]);

  const scheduleExport = useCallback(() => {
    if (exportTimerRef.current != null) {
      window.clearTimeout(exportTimerRef.current);
    }
    exportTimerRef.current = window.setTimeout(() => {
      exportTimerRef.current = null;
      exportComposite();
    }, EXPORT_DEBOUNCE_MS);
  }, [exportComposite]);

  useEffect(
    () => () => {
      if (exportTimerRef.current != null) {
        window.clearTimeout(exportTimerRef.current);
      }
    },
    [],
  );

  const blurFocusedField = () => {
    const active = document.activeElement;
    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement
    ) {
      active.blur();
    }
  };

  const beginDraw = (clientX: number, clientY: number) => {
    if (disabled) return;
    blurFocusedField();
    const point = canvasPoint(clientX, clientY);
    if (!point) return;
    drawingRef.current = true;
    lastPointRef.current = point;
    plotDot(point.x, point.y, eraserMode);
  };

  const moveDraw = (clientX: number, clientY: number) => {
    if (!drawingRef.current || disabled) return;
    const point = canvasPoint(clientX, clientY);
    if (!point) return;
    plotLine(point.x, point.y, eraserMode);
  };

  const endDraw = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    lastPointRef.current = null;
    const ink = inkRef.current;
    if (ink) {
      hasInkRef.current = canvasHasInk(ink);
    }
    scheduleExport();
  }, [scheduleExport]);

  useEffect(() => {
    const onWindowMouseUp = () => endDraw();
    window.addEventListener("mouseup", onWindowMouseUp);
    return () => window.removeEventListener("mouseup", onWindowMouseUp);
  }, [endDraw]);

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label ? (
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div
          ref={padRef}
          className={cn(
            "handwriting-canvas-pad relative w-full overflow-hidden bg-white",
            examPaperMode
              ? "exam-paper-handwriting-pad"
              : "rounded-md border-2 border-[#0b0f19]",
            disabled && "opacity-60",
          )}
          style={
            examPaperMode
              ? ({
                  "--exam-line-height": `${EXAM_LINE_HEIGHT}px`,
                  height: padHeight,
                } as CSSProperties)
              : { height: padHeight }
          }
        >
          {examPaperMode ? (
            <div className="exam-paper-input-ruling" aria-hidden="true" />
          ) : null}
          <canvas
            ref={linesRef}
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 block h-full w-full",
              examPaperMode ? "hidden" : "z-0",
            )}
          />
          <canvas
            ref={inkRef}
            className={cn(
              "absolute inset-0 z-[1] block h-full w-full touch-none select-none",
              disabled ? "cursor-not-allowed" : !eraserMode && "cursor-crosshair",
            )}
            style={!disabled && eraserMode ? { cursor: ERASER_CURSOR } : undefined}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              beginDraw(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => {
              if (!drawingRef.current) return;
              e.preventDefault();
              moveDraw(e.clientX, e.clientY);
            }}
            onMouseUp={() => endDraw()}
            onPointerDown={(e) => {
              if (e.pointerType === "mouse") return;
              e.preventDefault();
              e.stopPropagation();
              beginDraw(e.clientX, e.clientY);
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (e.pointerType === "mouse" || !drawingRef.current) return;
              e.preventDefault();
              moveDraw(e.clientX, e.clientY);
            }}
            onPointerUp={(e) => {
              if (e.pointerType === "mouse") return;
              try {
                e.currentTarget.releasePointerCapture(e.pointerId);
              } catch {
                // ignore
              }
              endDraw();
            }}
            onPointerCancel={(e) => {
              if (e.pointerType === "mouse") return;
              endDraw();
            }}
          />
          {!disabled ? (
            <Button
              type="button"
              variant={eraserMode ? "default" : "outline"}
              size="sm"
              className={cn(
                "absolute right-2 top-2 z-[2] h-8 gap-1.5 px-2.5 text-xs shadow-sm",
                eraserMode
                  ? "border-[#0b0f19] bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
                  : "border-[#0b0f19]/30 bg-white hover:bg-white",
              )}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setEraserMode((on) => !on)}
              aria-pressed={eraserMode}
              aria-label={eraserMode ? "Eraser on — click to draw" : "Eraser — click to erase"}
            >
              <Eraser className="size-3.5" />
              Eraser
            </Button>
          ) : null}
      </div>
    </div>
  );
}
