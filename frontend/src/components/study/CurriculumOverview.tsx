import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { cn } from "@/lib/utils";

type CurriculumOverviewProps = {
  markdown: string;
  className?: string;
};

/** Study-design notes for practice setup (markdown + KaTeX). */
export function CurriculumOverview({ markdown, className }: CurriculumOverviewProps) {
  return (
    <div
      className={cn(
        "curriculum-overview relative overflow-hidden rounded-2xl",
        "border border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/60",
        "px-5 py-7 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_48px_-20px_rgba(15,23,42,0.12)]",
        "ring-1 ring-black/[0.04] sm:rounded-3xl sm:px-8 sm:py-9",
        "text-slate-800 antialiased",
        "[&_.katex-error]:hidden",
        "[&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline [&_a]:decoration-brand/45 [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a]:transition-colors hover:[&_a]:text-brand hover:[&_a]:decoration-brand",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/35 to-transparent"
        aria-hidden
      />
      <RichQuestionContent text={markdown} preferMarkdown overviewMode />
    </div>
  );
}
