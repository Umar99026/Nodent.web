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
        "curriculum-overview rounded-2xl border border-black/10 bg-gradient-to-b from-white to-slate-50/80",
        "px-6 py-9 shadow-sm sm:px-10 sm:py-12",
        "text-[#0b0f19]",
        "[&_.katex-error]:hidden",
        className,
      )}
    >
      <RichQuestionContent text={markdown} preferMarkdown overviewMode />
    </div>
  );
}
