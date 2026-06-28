import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlus, X } from "lucide-react";

type Props = {
  images: string[];
  questionCount: number;
  onAddToQuestion: (imageUrl: string, questionIndex: number) => void;
  onRemove: (index: number) => void;
};

export function PhoneUploadGallery({
  images,
  questionCount,
  onAddToQuestion,
  onRemove,
}: Props) {
  if (!images.length) return null;

  return (
    <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ImagePlus className="size-4 text-brand" />
        <h3 className="text-sm font-semibold text-foreground">
          Received from phone ({images.length})
        </h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((url, i) => (
          <div
            key={`${url.slice(0, 48)}-${i}`}
            className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm"
          >
            <div className="relative aspect-[4/3] bg-muted/30">
              <img src={url} alt={`Phone upload ${i + 1}`} className="size-full object-contain" />
              <button
                type="button"
                className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                onClick={() => onRemove(i)}
                aria-label="Remove"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex items-center gap-2 p-2">
              {questionCount > 0 ? (
                <Select
                  onValueChange={(val) => {
                    const idx = Number(val);
                    if (Number.isFinite(idx)) onAddToQuestion(url, idx);
                  }}
                >
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="Add to question…" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: questionCount }, (_, q) => (
                      <SelectItem key={q} value={String(q)}>
                        Question {q + 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">Add a question first to attach this image.</p>
              )}
            </div>
          </div>
        ))}
      </div>
      {questionCount > 0 ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Choose a question to attach each image as a figure.
        </p>
      ) : null}
    </div>
  );
}
