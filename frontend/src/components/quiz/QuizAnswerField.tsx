import type { KeyboardEvent } from "react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AnswerInputToolbar, type AnswerInputMode } from "@/components/quiz/AnswerInputToolbar";
import { ExamPaperAnswerBlock } from "@/components/quiz/ExamPaperAnswerBlock";
import { HandwritingCanvas, type HandwritingSize } from "@/components/quiz/HandwritingCanvas";
import { WorkingAnswerHint } from "@/components/quiz/WorkingAnswerHint";
import {
  handwritingAllowedForSubject,
  isHandwritingValue,
  typedAnswerDisplay,
} from "@/lib/handwritingMode";
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
  /** Ruled-pad hint above handwriting (default on for main answer areas). */
  workingHint?: boolean;
};

function initialInputMode(value: string): AnswerInputMode {
  return isHandwritingValue(value) ? "pencil" : "text";
}

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
  workingHint = true,
}: QuizAnswerFieldProps) {
  const handwritingAvailable = handwritingAllowedForSubject(subjectId);
  const [inputMode, setInputMode] = useState<AnswerInputMode>(() => initialInputMode(value));
  const textValue = typedAnswerDisplay(value);
  const drawMode = inputMode === "pencil" || inputMode === "eraser";

  if (!handwritingAvailable) {
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

  const examLines = examPaperMode
    ? Math.max(6, multiline ? Math.max(rows, 10) : 8)
    : undefined;
  const size =
    handwritingSize ??
    (examPaperMode ? "lg" : multiline ? "lg" : rows >= 5 ? "lg" : "md");

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {label ? (
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      ) : null}
      <div
        className={cn(
          "answer-input-box overflow-hidden rounded-md border-2 border-[#0b0f19] bg-white",
          disabled && "opacity-60",
        )}
      >
        <AnswerInputToolbar
          mode={inputMode}
          onModeChange={setInputMode}
          disabled={disabled}
        />
        {drawMode ? (
          <div className="relative">
            {examPaperMode && workingHint ? (
              <div className="px-3 pt-2">
                <WorkingAnswerHint />
              </div>
            ) : null}
            <HandwritingCanvas
              value={value}
              onChange={onChange}
              disabled={disabled}
              size={size}
              examPaperMode={examPaperMode}
              lines={examLines}
              flushKey={flushKey}
              toolMode={inputMode === "eraser" ? "eraser" : "pencil"}
              embedded
            />
          </div>
        ) : examPaperMode ? (
          <ExamPaperAnswerBlock
            value={textValue}
            onChange={onChange}
            disabled={disabled}
            lines={multiline ? Math.max(2, rows) : 2}
            className="w-full min-w-0 border-0"
          />
        ) : multiline ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            rows={rows}
            onKeyDown={onKeyDown}
            className={cn(
              "min-h-[5rem] resize-y border-0 bg-transparent px-3 py-2.5 text-sm leading-relaxed shadow-none focus-visible:ring-0",
              className?.includes("exam-paper-input-field") && "exam-paper-input-field",
            )}
          />
        ) : (
          <Input
            value={textValue}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="border-0 bg-transparent px-3 text-base shadow-none focus-visible:ring-0"
          />
        )}
      </div>
    </div>
  );
}
