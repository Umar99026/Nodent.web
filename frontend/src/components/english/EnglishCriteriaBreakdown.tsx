import {
  BookMarked,
  Crosshair,
  LayoutTemplate,
  PenLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ENGLISH_CRITERION_LABELS,
  type EnglishCriterionKey,
  type EnglishCriterionScore,
} from "@/lib/englishEssay";

const CRITERION_ORDER: EnglishCriterionKey[] = [
  "structure",
  "evidence",
  "expression",
  "relevance",
];

const CRITERION_META: Record<
  EnglishCriterionKey,
  { icon: LucideIcon; accent: string; bg: string; ring: string }
> = {
  structure: {
    icon: LayoutTemplate,
    accent: "text-violet-700",
    bg: "bg-violet-50",
    ring: "ring-violet-200/80",
  },
  evidence: {
    icon: BookMarked,
    accent: "text-sky-700",
    bg: "bg-sky-50",
    ring: "ring-sky-200/80",
  },
  expression: {
    icon: PenLine,
    accent: "text-amber-800",
    bg: "bg-amber-50",
    ring: "ring-amber-200/80",
  },
  relevance: {
    icon: Crosshair,
    accent: "text-emerald-700",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200/80",
  },
};

type EnglishCriteriaBreakdownProps = {
  overall: number | null;
  criteria: Partial<Record<EnglishCriterionKey, EnglishCriterionScore>> | null;
  summary?: string | null;
  className?: string;
};

function scoreTone(score: number): string {
  if (score >= 8) return "text-emerald-700";
  if (score >= 6) return "text-[#0b0f19]";
  if (score >= 4) return "text-amber-700";
  return "text-red-700";
}

export function EnglishCriteriaBreakdown({
  overall,
  criteria,
  summary,
  className,
}: EnglishCriteriaBreakdownProps) {
  return (
    <div className={cn("space-y-10", className)}>
      {overall != null ? (
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative flex size-28 shrink-0 items-center justify-center rounded-full bg-[#0b0f19] shadow-lg shadow-[#0b0f19]/20">
              <span className="font-display text-4xl font-semibold tracking-tight text-white">
                {overall}
              </span>
              <span className="absolute -bottom-1 rounded-full bg-brand px-2.5 py-0.5 font-display text-[10px] font-semibold uppercase tracking-widest text-white">
                / 10
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-brand" aria-hidden />
                <p className="font-display text-lg font-semibold tracking-tight text-[#0b0f19]">
                  Overall grade
                </p>
              </div>
              {summary ? (
                <p className="max-w-xl font-exam-serif text-base leading-relaxed text-[#475569]">
                  {summary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Holistic VCE-style mark across all criteria.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : summary ? (
        <p className="max-w-3xl font-exam-serif text-base leading-relaxed text-[#475569]">
          {summary}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:gap-6">
        {CRITERION_ORDER.map((key) => {
          const row = criteria?.[key];
          const meta = CRITERION_META[key];
          const Icon = meta.icon;
          const score = row?.score;
          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border border-black/6 p-6 ring-1 ring-inset",
                meta.bg,
                meta.ring,
              )}
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-sm",
                      meta.accent,
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <div>
                    <p className="font-display text-sm font-semibold tracking-tight text-[#0b0f19]">
                      {ENGLISH_CRITERION_LABELS[key]}
                    </p>
                    <p className="text-xs text-muted-foreground">Marked out of 10</p>
                  </div>
                </div>
                {score != null ? (
                  <span
                    className={cn(
                      "font-display text-2xl font-semibold tabular-nums tracking-tight",
                      scoreTone(score),
                    )}
                  >
                    {score}
                  </span>
                ) : (
                  <span className="text-xl text-muted-foreground">—</span>
                )}
              </div>
              {row?.feedback ? (
                <p className="font-exam-serif text-[15px] leading-[1.7] text-[#334155]">
                  {row.feedback}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
