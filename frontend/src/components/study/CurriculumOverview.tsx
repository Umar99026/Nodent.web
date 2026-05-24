import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { cn } from "@/lib/utils";

type CurriculumOverviewProps = {
  markdown: string;
  className?: string;
};

/** Large, bold, spacious study-design notes for practice setup. */
export function CurriculumOverview({ markdown, className }: CurriculumOverviewProps) {
  return (
    <div
      className={cn(
        "curriculum-overview rounded-2xl border-2 border-black/10 bg-gradient-to-b from-white via-slate-50/90 to-slate-100/60",
        "px-8 py-10 shadow-inner sm:px-12 sm:py-14",
        "text-[#0b0f19]",
        "[&_.katex-error]:hidden",
        className,
      )}
    >
      <RichQuestionContent
        text={markdown}
        preferMarkdown
        overviewMode
        className={cn(
          "prose prose-slate max-w-none",
          "text-lg leading-[1.9] sm:text-xl sm:leading-[2]",
          "prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-[#0b0f19]",
          "prose-h2:mb-8 prose-h2:mt-14 prose-h2:first:mt-0 prose-h2:text-3xl prose-h2:font-bold sm:prose-h2:text-[2.35rem] sm:prose-h2:leading-[1.15]",
          "prose-h3:mb-5 prose-h3:mt-12 prose-h3:border-b-2 prose-h3:border-brand/30 prose-h3:pb-3",
          "prose-h3:text-xl prose-h3:font-bold sm:prose-h3:text-[1.55rem] sm:prose-h3:leading-snug",
          "prose-h4:mb-4 prose-h4:mt-8 prose-h4:text-lg prose-h4:font-bold sm:prose-h4:text-xl",
          "prose-p:my-7 prose-p:text-lg prose-p:font-medium prose-p:leading-[1.9] sm:prose-p:text-xl sm:prose-p:leading-[2]",
          "prose-strong:font-bold prose-strong:text-[#0b0f19]",
          "prose-ul:my-8 prose-ul:space-y-4 prose-ul:pl-7 sm:prose-ul:pl-8",
          "prose-ol:my-8 prose-ol:space-y-4",
          "prose-li:my-2 prose-li:text-lg prose-li:font-medium prose-li:leading-[1.85] sm:prose-li:text-xl sm:prose-li:leading-[1.95]",
          "prose-li:marker:text-brand prose-li:marker:font-bold",
          "prose-hr:my-16 prose-hr:border-0 prose-hr:border-t-2 prose-hr:border-black/12",
          "prose-table:my-8 prose-table:w-full prose-table:border-collapse",
          "prose-th:bg-slate-200/80 prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:text-base prose-th:font-bold sm:prose-th:text-lg",
          "prose-td:px-4 prose-td:py-3 prose-td:text-base prose-td:font-medium sm:prose-td:text-lg",
          "[&_table]:w-full [&_table]:text-base sm:[&_table]:text-lg",
          "[&_th]:border [&_th]:border-black/15 [&_th]:text-base [&_th]:font-bold sm:[&_th]:text-lg",
          "[&_td]:border [&_td]:border-black/10 [&_td]:align-middle [&_td]:text-base sm:[&_td]:text-lg",
          "[&_table_.katex]:!text-[1.05em] [&_table_.katex]:whitespace-nowrap",
          "[&_table_.katex-display]:my-2 [&_table_.katex-display]:!text-base",
          "prose-code:rounded-md prose-code:bg-white prose-code:px-2 prose-code:py-1 prose-code:text-base prose-code:font-semibold",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-pre:my-10 prose-pre:rounded-xl prose-pre:border-2 prose-pre:border-black/10",
          "prose-pre:bg-white prose-pre:px-6 prose-pre:py-5 prose-pre:text-base prose-pre:font-medium sm:prose-pre:text-lg",
        )}
      />
    </div>
  );
}
