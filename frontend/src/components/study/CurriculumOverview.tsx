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
        "border border-black/10 border-l-4 border-l-brand-light/70 bg-[#f3f4f6]/50",
        "px-5 py-7 sm:rounded-3xl sm:px-8 sm:py-9",
        "text-[#0b0f19] antialiased",
        "[&_.katex-error]:hidden",
        "[&_a]:font-medium [&_a]:text-brand-deep [&_a]:underline [&_a]:decoration-brand/45 [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a]:transition-colors hover:[&_a]:text-brand hover:[&_a]:decoration-brand",
        className,
      )}
    >
      <RichQuestionContent text={markdown} preferMarkdown overviewMode />
    </div>
  );
}
