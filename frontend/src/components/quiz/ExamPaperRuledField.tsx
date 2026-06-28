import type { CSSProperties } from "react";
import { ExamPaperMathField } from "@/components/quiz/ExamPaperMathField";
import {
  EXAM_BLOCK_LINE_HEIGHT,
  EXAM_OVERLAY_LINE_HEIGHT,
  examPaperVisibleLines,
} from "@/lib/examPaperInputLines";
import { cn } from "@/lib/utils";

type ExamPaperRuledFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Starting ruled line count before content grows the box. */
  minLines?: number;
  /** `block` = quiz / long answer; `overlay` = box on exam PDF image. */
  variant?: "block" | "overlay";
  className?: string;
  shellClassName?: string;
  transparentInput?: boolean;
};

export function ExamPaperRuledField({
  value,
  onChange,
  disabled = false,
  minLines = 2,
  variant = "block",
  className,
  shellClassName,
  transparentInput = false,
}: ExamPaperRuledFieldProps) {
  const lineHeightPx =
    variant === "overlay" ? EXAM_OVERLAY_LINE_HEIGHT : EXAM_BLOCK_LINE_HEIGHT;
  const visibleLines = examPaperVisibleLines(value, minLines);
  const ruledHeightPx = visibleLines * lineHeightPx + 6;

  const shellStyle = {
    "--exam-line-height": `${lineHeightPx}px`,
    "--exam-visible-lines": visibleLines,
    minHeight: `${ruledHeightPx}px`,
  } as CSSProperties;

  if (variant === "overlay") {
    const overlayStyle = {
      ...shellStyle,
      height: "100%",
      minHeight: 0,
    } as CSSProperties;

    return (
      <div
        className={cn(
          "exam-paper-input-shell exam-paper-ruled-grow",
          transparentInput
            ? "exam-paper-input-shell--transparent"
            : "exam-paper-input-shell--filled",
          shellClassName,
        )}
        style={overlayStyle}
      >
        {!transparentInput ? <div className="exam-paper-input-ruling" aria-hidden="true" /> : null}
        <ExamPaperMathField
          value={value}
          onChange={onChange}
          disabled={disabled}
          lineHeightPx={lineHeightPx}
          className={cn("exam-paper-input-field field-sizing-fixed !min-h-0", className)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("exam-paper-answer-block exam-paper-ruled-grow", shellClassName)}
      style={shellStyle}
    >
      <div className="exam-paper-input-ruling" aria-hidden="true" />
      <ExamPaperMathField
        value={value}
        onChange={onChange}
        disabled={disabled}
        lineHeightPx={lineHeightPx}
        className={className}
      />
    </div>
  );
}
