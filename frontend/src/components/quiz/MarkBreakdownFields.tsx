import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { QuizAnswerField } from "@/components/quiz/QuizAnswerField";
import { useHandwritingModeActive } from "@/context/HandwritingModeContext";
import { cn } from "@/lib/utils";
import type { MarkBreakdown, MarkBreakdownStep } from "@/lib/markBreakdown";
import { CheckCircle2, XCircle } from "lucide-react";

type MarkBreakdownInputsProps = {
  breakdown: MarkBreakdown;
  values: string[];
  onChange: (index: number, value: string) => void;
  disabled?: boolean;
  submitted?: boolean;
  stepResults?: boolean[];
  className?: string;
  subjectId?: string;
  examPaperMode?: boolean;
  flushKeyPrefix?: string;
};

export function MarkBreakdownInputs({
  breakdown,
  values,
  onChange,
  disabled = false,
  submitted = false,
  stepResults = [],
  className,
  subjectId = "",
  examPaperMode = false,
  flushKeyPrefix = "",
}: MarkBreakdownInputsProps) {
  const handwritingMode = useHandwritingModeActive(subjectId);
  const ruledAnswer = examPaperMode || handwritingMode;

  return (
    <div className={cn("space-y-3", className)}>
      {breakdown.steps.map((step: MarkBreakdownStep, idx) => {
        const ok = stepResults[idx];
        return (
          <div
            key={idx}
            className={cn(
              "rounded-lg border px-3 py-2.5",
              submitted && ok === true && "border-success/35 bg-success/5",
              submitted && ok === false && "border-danger/25 bg-danger/[0.04]",
              !submitted && "border-black/10 bg-white/60",
            )}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {step.marks} {step.marks === 1 ? "mark" : "marks"}
                </p>
                <div className="text-sm font-medium text-foreground">
                  <RichQuestionContent
                    text={step.label}
                    className="prose prose-sm max-w-none prose-p:my-0"
                  />
                </div>
              </div>
              {submitted && ok === true ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : null}
              {submitted && ok === false ? (
                <XCircle className="size-4 shrink-0 text-danger" />
              ) : null}
            </div>
            <QuizAnswerField
              value={values[idx] ?? ""}
              onChange={(value) => onChange(idx, value)}
              disabled={disabled}
              subjectId={subjectId}
              examPaperMode={ruledAnswer}
              multiline
              rows={handwritingMode ? 4 : 2}
              handwritingSize="md"
              workingHint={false}
              flushKey={flushKeyPrefix ? `${flushKeyPrefix}:step-${idx}` : undefined}
              placeholder={`Working for mark ${idx + 1}…`}
              className="text-sm"
            />
          </div>
        );
      })}
    </div>
  );
}

type MarkBreakdownFeedbackProps = {
  stepResults: Array<{
    index: number;
    marks: number;
    marksAwarded: number;
    label: string;
    model?: string;
    studentText?: string;
    awarded: boolean;
    feedback?: string;
  }>;
  className?: string;
};

export function MarkBreakdownFeedbackPanel({ stepResults, className }: MarkBreakdownFeedbackProps) {
  if (!stepResults.length) return null;
  const earned = stepResults.reduce((s, r) => s + r.marksAwarded, 0);
  const total = stepResults.reduce((s, r) => s + r.marks, 0);

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-sm",
        className,
      )}
    >
      <p className="font-semibold text-foreground">
        Mark breakdown: {earned} / {total} {total === 1 ? "mark" : "marks"}
      </p>
      <ul className="space-y-2.5">
        {stepResults.map((step) => (
          <li
            key={step.index}
            className={cn(
              "rounded-md border px-3 py-2.5",
              step.awarded ? "border-success/25 bg-white/80" : "border-danger/20 bg-white/80",
            )}
          >
            <div className="flex items-start gap-2">
              {step.awarded ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {step.label}{" "}
                  <span className="text-muted-foreground">
                    ({step.marksAwarded}/{step.marks})
                  </span>
                </p>
                {step.studentText ? (
                  <p className="text-xs text-muted-foreground">
                    You wrote:{" "}
                    <span className="font-medium text-foreground">
                      <RichQuestionContent
                        text={step.studentText}
                        feedbackMode
                        className="inline prose prose-sm max-w-none prose-p:my-0 [&_p]:inline"
                      />
                    </span>
                  </p>
                ) : null}
                {step.model && !step.awarded ? (
                  <p className="text-xs text-muted-foreground">
                    Expected:{" "}
                    <span className="font-medium text-foreground">
                      <RichQuestionContent
                        text={step.model}
                        feedbackMode
                        className="inline prose prose-sm max-w-none prose-p:my-0 [&_p]:inline"
                      />
                    </span>
                  </p>
                ) : null}
                {step.feedback ? (
                  <div className="text-xs text-muted-foreground">
                    <RichQuestionContent
                      text={step.feedback}
                      feedbackMode
                      className="prose prose-sm max-w-none prose-p:my-0"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
