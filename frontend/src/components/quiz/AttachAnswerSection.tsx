import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { cn } from "@/lib/utils";
import { Paperclip, Loader2, X } from "lucide-react";

type Props = {
  images: string[];
  onImagesChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
  inlineAction?: ReactNode;
};

/**
 * Local file attach for written answers (compressed to data URLs, saved with PUT /written).
 */
export function AttachAnswerSection({
  images,
  onImagesChange,
  disabled = false,
  className,
  inlineAction,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || disabled) return;
    setBusy(true);
    try {
      const next = [...images];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith("image/")) continue;
        const url = await compressImageFileToDataUrl(f);
        next.push(url);
      }
      onImagesChange(next);
    } catch {
      // ignore per-file errors; user can retry
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-black/10 bg-white/60 p-3 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-black px-4 text-xs font-semibold text-white transition-colors hover:bg-black/90"
          >
            <Paperclip className="size-3.5" />
            {open ? "Hide attach" : "Attach"}
          </button>
          {inlineAction}
        </div>
        {images.length > 0 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {images.length} attached
          </span>
        ) : null}
      </div>

      {(open || images.length > 0) && (
        <div className="mt-3 space-y-3 rounded-lg border border-black/10 bg-white/90 p-3 animate-in fade-in-0 zoom-in-95 duration-150">
          <p className="text-xs text-muted-foreground">
            Upload photos/screenshots of your working. Saved with your answer.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={disabled || busy}
              onChange={onPick}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-2 rounded-full border-black bg-black text-white transition-colors hover:bg-black/90 hover:text-white"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Paperclip className="size-4" />
              )}
              Choose files
            </Button>
          </div>

          {images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {images.map((url, i) => (
                <li
                  key={`${i}-${url.slice(0, 24)}`}
                  className="relative overflow-hidden rounded-md border border-black/10 bg-white/80 p-0.5"
                >
                  <img
                    src={url}
                    alt=""
                    className="h-24 w-full rounded object-cover"
                  />
                  <button
                    type="button"
                    disabled={disabled}
                    className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full border border-black/15 bg-white text-foreground shadow-sm hover:bg-muted disabled:opacity-50"
                    aria-label="Remove attachment"
                    onClick={() => onImagesChange(images.filter((_, j) => j !== i))}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
