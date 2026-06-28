import { ExamPaperRuledField } from "@/components/quiz/ExamPaperRuledField";
import { WorkingAnswerHint } from "@/components/quiz/WorkingAnswerHint";
import { cn } from "@/lib/utils";

type ExamPaperAnswerBlockProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Minimum ruled lines; box grows as the student types. */
  lines?: number;
  className?: string;
};

export function ExamPaperAnswerBlock({
  value,
  onChange,
  disabled = false,
  lines = 2,
  className,
}: ExamPaperAnswerBlockProps) {
  const minLines = Math.max(1, Math.min(24, Math.round(lines)));

  return (
    <div className={cn("w-full min-w-0 space-y-1.5", className)}>
      <WorkingAnswerHint />
      <ExamPaperRuledField
        value={value}
        onChange={onChange}
        disabled={disabled}
        minLines={minLines}
        variant="block"
      />
    </div>
  );
}
