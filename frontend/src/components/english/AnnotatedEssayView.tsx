import { useMemo, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnglishHighlight } from "@/lib/englishEssay";
import { ENGLISH_CRITERION_LABELS } from "@/lib/englishEssay";

type Segment =
  | { kind: "text"; text: string }
  | { kind: "highlight"; text: string; highlight: EnglishHighlight };

function findQuoteIndex(text: string, quote: string, fromIndex: number): number {
  if (!quote) return -1;
  const direct = text.indexOf(quote, fromIndex);
  if (direct >= 0) return direct;
  const lower = text.toLowerCase();
  const qLower = quote.toLowerCase();
  return lower.indexOf(qLower, fromIndex);
}

function buildSegments(text: string, highlights: EnglishHighlight[]): Segment[] {
  if (!text.trim() || !highlights.length) {
    return [{ kind: "text", text }];
  }

  const matches: { start: number; end: number; highlight: EnglishHighlight }[] = [];
  for (const highlight of highlights) {
    const quote = highlight.quote.trim();
    if (!quote) continue;
    let cursor = 0;
    let guard = 0;
    while (cursor < text.length && guard < 4) {
      const start = findQuoteIndex(text, quote, cursor);
      if (start < 0) break;
      const end = start + quote.length;
      const overlaps = matches.some((m) => start < m.end && end > m.start);
      if (!overlaps) {
        matches.push({ start, end, highlight });
      }
      cursor = end;
      guard += 1;
    }
  }

  if (!matches.length) return [{ kind: "text", text }];

  matches.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: typeof matches = [];
  for (const match of matches) {
    const last = merged[merged.length - 1];
    if (last && match.start < last.end) continue;
    merged.push(match);
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const match of merged) {
    if (match.start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, match.start) });
    }
    segments.push({
      kind: "highlight",
      text: text.slice(match.start, match.end),
      highlight: match.highlight,
    });
    cursor = match.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}

type AnnotatedEssayViewProps = {
  text: string;
  highlights?: EnglishHighlight[];
  className?: string;
};

export function AnnotatedEssayView({ text, highlights = [], className }: AnnotatedEssayViewProps) {
  const segments = useMemo(() => buildSegments(text, highlights), [text, highlights]);
  const [active, setActive] = useState<EnglishHighlight | null>(null);

  return (
    <div className={cn("relative", className)}>
      {highlights.length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-4 border-b border-black/8 pb-5">
          <span className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
            <CheckCircle2 className="size-4" aria-hidden />
            Strengths
          </span>
          <span className="inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-[0.14em] text-red-800">
            <CircleAlert className="size-4" aria-hidden />
            Improve
          </span>
          <span className="text-xs text-muted-foreground sm:ml-auto">
            Tap highlighted phrases for detail
          </span>
        </div>
      ) : null}

      <div className="font-exam-serif text-[17px] leading-[1.9] text-[#1a1f2e] sm:text-[18px]">
        {segments.map((segment, index) => {
          if (segment.kind === "text") {
            return <span key={`t-${index}`}>{segment.text}</span>;
          }
          const isStrength = segment.highlight.type === "strength";
          const isOpen =
            active?.quote === segment.highlight.quote &&
            active?.feedback === segment.highlight.feedback &&
            active?.type === segment.highlight.type;
          return (
            <span key={`h-${index}`} className="relative inline">
              <button
                type="button"
                className={cn(
                  "mx-0.5 rounded-md px-1 py-0.5 underline decoration-2 underline-offset-[5px] transition-all",
                  isStrength
                    ? "bg-emerald-100/95 decoration-emerald-600 hover:bg-emerald-200/90"
                    : "bg-red-100/95 decoration-red-600 hover:bg-red-200/90",
                  isOpen && (isStrength ? "ring-2 ring-emerald-500/70" : "ring-2 ring-red-500/70"),
                )}
                onClick={() =>
                  setActive((prev) =>
                    prev?.quote === segment.highlight.quote &&
                    prev?.feedback === segment.highlight.feedback
                      ? null
                      : segment.highlight,
                  )
                }
              >
                {segment.text}
              </button>
              {isOpen ? (
                <span
                  className={cn(
                    "absolute left-0 top-full z-30 mt-3 block w-[min(100vw-3rem,26rem)] rounded-xl border p-4 text-left shadow-xl",
                    isStrength
                      ? "border-emerald-200/90 bg-emerald-50 text-emerald-950"
                      : "border-red-200/90 bg-red-50 text-red-950",
                  )}
                  role="tooltip"
                >
                  <span className="mb-2 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {isStrength ? (
                      <CheckCircle2 className="size-3.5" aria-hidden />
                    ) : (
                      <CircleAlert className="size-3.5" aria-hidden />
                    )}
                    {isStrength ? "Strength" : "Improve"}
                    {segment.highlight.criterion
                      ? ` · ${ENGLISH_CRITERION_LABELS[segment.highlight.criterion]}`
                      : ""}
                  </span>
                  <span className="font-exam-serif text-sm leading-relaxed">
                    {segment.highlight.feedback}
                  </span>
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
