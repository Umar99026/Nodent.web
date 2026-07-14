import { SmartMarkingBulletList, parseMarkingBulletLines } from "@/components/quiz/AiMarkingFeedbackPanel";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { buildWrongAnswerBullets } from "@/lib/wrongAnswerFeedback";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

export type QuestionFeedbackPart = {
  label: string;
  correct: boolean;
  studentAnswer?: string;
  correctAnswer?: string;
  feedback?: string;
  marks?: number;
};

export type QuestionFeedbackStep = {
  index: number;
  label: string;
  model?: string;
  feedback?: string;
  awarded: boolean;
  marks?: number;
  marksAwarded?: number;
};

type QuestionFeedbackPanelProps = {
  correct: boolean;
  studentAnswer?: string;
  correctAnswers?: string[];
  guidance?: string;
  questionText?: string;
  aiFeedback?: string;
  interpretedAnswer?: string;
  parts?: QuestionFeedbackPart[];
  steps?: QuestionFeedbackStep[];
  stepsLoading?: boolean;
  score?: { earned: number; total: number };
  genericOnly?: boolean;
  bullets?: string[];
  className?: string;
};

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines
    .map((line) => String(line ?? "").trim())
    .filter(Boolean)
    .filter((line) => {
      const key = line.toLowerCase().replace(/^[•\-–]\s*/, "").replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function linesFromAi(feedback: string | undefined): string[] {
  return parseMarkingBulletLines(String(feedback ?? ""));
}

export function QuestionFeedbackPanel({
  correct,
  studentAnswer = "",
  correctAnswers = [],
  guidance,
  questionText,
  aiFeedback,
  interpretedAnswer,
  parts = [],
  steps = [],
  stepsLoading = false,
  score,
  genericOnly = false,
  bullets = [],
  className,
}: QuestionFeedbackPanelProps) {
  const wrongParts = parts.filter((part) => !part.correct);
  const missedSteps = correct ? [] : steps.filter((step) => !step.awarded);
  const hasAuthoredSteps = missedSteps.length > 0;
  const baseLines = correct
    ? uniqueLines([...linesFromAi(aiFeedback), "Correct! Well done."])
    : uniqueLines([
        ...linesFromAi(aiFeedback),
        ...bullets,
        ...(parts.length || steps.length
          ? !parts.length && correctAnswers[0]
            ? [`Correct answer: ${correctAnswers[0]}`]
            : []
          : buildWrongAnswerBullets({
              studentAnswer: interpretedAnswer || studentAnswer,
              expectedAnswers: correctAnswers,
              guidance,
              questionText,
              genericOnly,
            })),
      ]);

  return (
    <section
      data-question-feedback="true"
      className={cn(
        "rounded-xl border px-4 py-4 text-sm",
        correct
          ? "border-success/25 bg-success/5"
          : "border-danger/20 bg-danger/[0.04]",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {correct ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        ) : (
          <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Feedback
            </h3>
            {score && score.total > 0 ? (
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                {score.earned} / {score.total} {score.total === 1 ? "mark" : "marks"}
              </span>
            ) : null}
          </div>

          {interpretedAnswer ? (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                We interpreted your drawing as
              </p>
              <RichQuestionContent
                text={interpretedAnswer}
                feedbackMode
                className="prose prose-sm max-w-none prose-p:my-0 prose-p:font-semibold"
              />
            </div>
          ) : null}

          {baseLines.length ? (
            <SmartMarkingBulletList
              text={baseLines.map((line) => `• ${line}`).join("\n")}
              className="mt-3"
            />
          ) : null}

          {wrongParts.length ? (
            <div className="mt-4 divide-y divide-black/10 border-t border-black/10">
              {wrongParts.map((part, index) => {
                const partLines = uniqueLines([
                  ...linesFromAi(part.feedback),
                  ...buildWrongAnswerBullets({
                    studentAnswer: part.studentAnswer ?? "",
                    expectedAnswers: part.correctAnswer ? [part.correctAnswer] : [],
                    guidance: hasAuthoredSteps ? undefined : guidance,
                    questionText,
                    genericOnly,
                  }),
                ]);
                return (
                  <div key={`${part.label}-${index}`} className="py-3 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-foreground">
                        <RichQuestionContent
                          text={part.label}
                          feedbackMode
                          className="prose prose-sm max-w-none prose-p:my-0 prose-p:font-semibold"
                        />
                      </div>
                      {part.marks ? (
                        <span className="text-xs text-muted-foreground">0 / {part.marks}</span>
                      ) : null}
                    </div>
                    <SmartMarkingBulletList
                      text={partLines.map((line) => `• ${line}`).join("\n")}
                      className="mt-2"
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {missedSteps.length ? (
            <div className="mt-4 border-t border-black/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                How to get it
              </p>
              <ol className="mt-2 space-y-2 text-xs text-muted-foreground">
                {missedSteps.map((step, index) => (
                  <li key={step.index} className="flex gap-2.5">
                    <span className="font-semibold text-foreground">{index + 1}.</span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-foreground">{step.label}</p>
                      {step.model ? (
                        <RichQuestionContent
                          text={step.model}
                          feedbackMode
                          className="prose prose-sm max-w-none prose-p:my-0"
                        />
                      ) : step.feedback ? (
                        <RichQuestionContent
                          text={step.feedback}
                          feedbackMode
                          className="prose prose-sm max-w-none prose-p:my-0"
                        />
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {!correct && stepsLoading && !missedSteps.length ? (
            <div className="mt-4 border-t border-black/10 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                How to get it
              </p>
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-brand" aria-hidden />
                Generating the exact worked steps for this question…
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
