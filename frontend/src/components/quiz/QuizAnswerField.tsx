import type { KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ExamPaperAnswerBlock } from "@/components/quiz/ExamPaperAnswerBlock";
import { HandwritingCanvas, type HandwritingSize } from "@/components/quiz/HandwritingCanvas";
import { WorkingAnswerHint } from "@/components/quiz/WorkingAnswerHint";
import { useHandwritingModeActive } from "@/context/HandwritingModeContext";
import { typedAnswerDisplay } from "@/lib/handwritingMode";
import { cn } from "@/lib/utils";

type QuizAnswerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  className?: string;
  handwritingSize?: HandwritingSize;
  label?: string;
  subjectId?: string;
  /** VCE booklet: dotted ruling, Return for new line, serif typed math overlay */
  examPaperMode?: boolean;
  /** Sync export before submit (handwriting pads). */
  flushKey?: string;
};

export function QuizAnswerField({
  value,
  onChange,
  disabled = false,
  placeholder,
  multiline = false,
  rows = 3,
  onKeyDown,
  className,
  handwritingSize,
  label,
  subjectId,
  examPaperMode = false,
  flushKey,
}: QuizAnswerFieldProps) {
  const handwritingMode = useHandwritingModeActive(subjectId);
  const textValue = typedAnswerDisplay(value);

  if (handwritingMode) {
    const examLines = examPaperMode
      ? Math.max(6, multiline ? Math.max(rows, 10) : 8)
      : undefined;
    const size =
      handwritingSize ??
      (examPaperMode ? "lg" : multiline ? "lg" : rows >= 5 ? "lg" : "md");
    return (
      <div className={cn("space-y-1.5", className)}>
        {examPaperMode ? <WorkingAnswerHint /> : null}
        <HandwritingCanvas
          value={value}
          onChange={onChange}
          disabled={disabled}
          size={size}
          examPaperMode={examPaperMode}
          lines={examLines}
          label={label}
          flushKey={flushKey}
        />
      </div>
    );
  }

  if (examPaperMode) {
    const lines = multiline ? Math.max(2, rows) : 2;
    return (
      <ExamPaperAnswerBlock
        value={textValue}
        onChange={onChange}
        disabled={disabled}
        lines={lines}
        className={cn("w-full min-w-0", className)}
      />
    );
  }

  if (multiline) {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        onKeyDown={onKeyDown}
        className={cn(
          className?.includes("exam-paper-input-field")
            ? "border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
            : "bg-white/60 text-sm leading-relaxed",
          className,
        )}
      />
    );
  }

  return (
    <Input
      value={textValue}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className={cn("bg-white/60 text-base", className)}
    />
  );
}
