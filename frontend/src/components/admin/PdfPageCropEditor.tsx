import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import {
  cropImageDataUrl,
  FULL_CROP,
  type CropRect,
} from "@/lib/pdfImageCrop";
type DisplayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type Props = {
  imageDataUrl: string;
  crop: CropRect;
  onCropChange: (next: CropRect) => void;
  onApply: (croppedDataUrl: string) => void;
  onCancel: () => void;
};

function computeImageDisplayRect(
  containerW: number,
  containerH: number,
  naturalW: number,
  naturalH: number,
): DisplayRect {
  if (!naturalW || !naturalH || !containerW || !containerH) {
    return { left: 0, top: 0, width: containerW, height: containerH };
  }
  const scale = Math.min(containerW / naturalW, containerH / naturalH);
  const width = naturalW * scale;
  const height = naturalH * scale;
  return {
    left: (containerW - width) / 2,
    top: (containerH - height) / 2,
    width,
    height,
  };
}

function isMeaningfulCrop(rect: CropRect): boolean {
  return (
    rect.w > 0.02 &&
    rect.h > 0.02 &&
    (rect.x > 0.01 || rect.y > 0.01 || rect.w < 0.98 || rect.h < 0.98)
  );
}

export function PdfPageCropEditor({
  imageDataUrl,
  crop,
  onCropChange,
  onApply,
  onCancel,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<CropRect>(crop);
  const [busy, setBusy] = useState(false);
  const [displayRect, setDisplayRect] = useState<DisplayRect | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setDraft(crop);
  }, [crop]);

  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  const measureDisplayRect = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;
    const cr = container.getBoundingClientRect();
    setDisplayRect(
      computeImageDisplayRect(
        cr.width,
        cr.height,
        img.naturalWidth,
        img.naturalHeight,
      ),
    );
  }, []);

  useEffect(() => {
    if (fullscreen) {
      const t = window.setTimeout(() => measureDisplayRect(), 50);
      return () => window.clearTimeout(t);
    }
  }, [fullscreen, measureDisplayRect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    measureDisplayRect();
    const ro = new ResizeObserver(() => measureDisplayRect());
    ro.observe(container);
    return () => ro.disconnect();
  }, [measureDisplayRect, imageDataUrl]);

  const pointerToNorm = useCallback(
    (clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el || !displayRect?.width || !displayRect.height) {
        return { x: 0, y: 0 };
      }
      const r = el.getBoundingClientRect();
      const localX = clientX - r.left - displayRect.left;
      const localY = clientY - r.top - displayRect.top;
      return {
        x: Math.max(0, Math.min(1, localX / displayRect.width)),
        y: Math.max(0, Math.min(1, localY / displayRect.height)),
      };
    },
    [displayRect],
  );

  const rectFromPoints = useCallback(
    (a: { x: number; y: number }, b: { x: number; y: number }): CropRect => {
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      return { x, y, w, h };
    },
    [],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    const p = pointerToNorm(e.clientX, e.clientY);
    setStart(p);
    setDraft({ x: p.x, y: p.y, w: 0, h: 0 });
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !start) return;
    const p = pointerToNorm(e.clientX, e.clientY);
    setDraft(rectFromPoints(start, p));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const end = start ? pointerToNorm(e.clientX, e.clientY) : null;
    setStart(null);
    if (!start || !end) return;
    const final = rectFromPoints(start, end);
    setDraft(final);
    if (final.w > 0.02 && final.h > 0.02) {
      onCropChange(final);
    }
  };

  const applyCrop = async () => {
    const rect = draft.w > 0.02 && draft.h > 0.02 ? draft : crop;
    if (!isMeaningfulCrop(rect)) {
      toast.error("Drag on the image to select an area first.");
      return;
    }
    setBusy(true);
    try {
      const cropped = await cropImageDataUrl(imageDataUrl, rect);
      onApply(cropped);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not apply crop.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const active = draft.w > 0.02 && draft.h > 0.02 ? draft : crop;
  const overlay =
    displayRect && active.w > 0 && active.h > 0
      ? {
          left: displayRect.left + active.x * displayRect.width,
          top: displayRect.top + active.y * displayRect.height,
          width: active.w * displayRect.width,
          height: active.h * displayRect.height,
        }
      : null;

  const panel = (
    <div
      className={cn(
        "space-y-3",
        fullscreen
          ? "flex h-full min-h-0 flex-col"
          : "rounded-lg border border-brand/30 bg-brand/5 p-3",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p
          className={cn(
            "text-xs",
            fullscreen ? "text-white/70" : "text-muted-foreground",
          )}
        >
          Drag on the image to select the area students should see, then click{" "}
          <span className={cn("font-medium", fullscreen ? "text-white" : "text-foreground")}>
            Apply crop
          </span>
          . {fullscreen ? "Press Esc to exit fullscreen." : null}
        </p>
        <Button
          type="button"
          size="sm"
          variant={fullscreen ? "secondary" : "outline"}
          className="shrink-0 gap-1.5"
          onClick={() => setFullscreen((v) => !v)}
        >
          {fullscreen ? (
            <>
              <Minimize2 className="size-3.5" />
              Exit fullscreen
            </>
          ) : (
            <>
              <Maximize2 className="size-3.5" />
              Fullscreen
            </>
          )}
        </Button>
      </div>
      <div
        ref={containerRef}
        className={cn(
          "relative mx-auto w-full cursor-crosshair select-none overflow-hidden rounded-md border bg-white",
          fullscreen
            ? "flex min-h-0 flex-1 items-center justify-center border-white/20"
            : "max-h-80 border-black/15",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <img
          ref={imgRef}
          src={imageDataUrl}
          alt="Crop preview"
          className={cn(
            "pointer-events-none object-contain",
            fullscreen ? "max-h-full max-w-full" : "max-h-80 w-full",
          )}
          draggable={false}
          onLoad={measureDisplayRect}
        />
        {overlay ? (
          <div
            className="pointer-events-none absolute border-2 border-brand bg-brand/15"
            style={{
              left: overlay.left,
              top: overlay.top,
              width: overlay.width,
              height: overlay.height,
            }}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={busy || !isMeaningfulCrop(active)}
          onClick={() => void applyCrop()}
        >
          {busy ? "Cropping…" : "Apply crop"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={fullscreen ? "border-white/25 bg-white/10 text-white hover:bg-white/20" : undefined}
          onClick={() => {
            setDraft(FULL_CROP);
            onCropChange(FULL_CROP);
          }}
        >
          Reset crop
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={fullscreen ? "text-white/80 hover:bg-white/10 hover:text-white" : undefined}
          onClick={() => {
            setFullscreen(false);
            onCancel();
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  if (fullscreen) {
    return createPortal(
      <div className="fixed inset-0 z-[200] flex flex-col bg-[#0b0f19] p-3 sm:p-5">
        {panel}
      </div>,
      document.body,
    );
  }

  return panel;
}

export { isMeaningfulCrop };
