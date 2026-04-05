import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeImageUrls } from "@/lib/practiceQuestions";

/** Shared passage / stimulus block for MCQ, short, and long practice questions. */
export function PassageBlock({ passage }: { passage?: string }) {
  if (!passage?.trim()) return null;
  return (
    <Card className="border-l-4 border-l-brand/40 bg-muted/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <BookOpen className="size-4 shrink-0" />
          Stimulus / passage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <blockquote className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {passage.trim()}
        </blockquote>
      </CardContent>
    </Card>
  );
}

/**
 * Renders question images (URLs or data URLs from Sheets `image_urls_json`).
 * Uses object-contain so diagrams and charts are not over-cropped.
 */
export function QuestionImageGrid({ urls }: { urls?: string[] }) {
  const normalized = normalizeImageUrls(urls);
  if (!normalized?.length) return null;
  const list = normalized.map((u) => u.trim()).filter(Boolean);
  if (!list.length) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Figures & images
      </p>
      <div className="max-h-[min(70vh,560px)] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          {list.map((src) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm outline-none ring-brand/30 focus-visible:ring-2"
              title="Open image in new tab"
            >
              <img
                src={src}
                alt="Question figure"
                className="max-h-72 w-full bg-muted/20 object-contain object-center sm:max-h-80"
                loading="lazy"
                decoding="async"
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
