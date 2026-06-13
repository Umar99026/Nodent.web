import { useState, useEffect } from "react";
import { cn, getQuestionTypeLabel } from "@/lib/utils";
import type { McqQuestion as McqQuestionType } from "@/lib/subjects";
import {
  collectStimulusFromQuestion,
  displayMarks,
  hasVisibleStimulus,
  stripQuestionHeadingFromPassage,
  stripQuestionNumberPrefix,
} from "@/lib/questionDisplay";
import { Badge } from "@/components/ui/badge";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { CheckCircle2, XCircle } from "lucide-react";

interface McqQuestionProps {
  question: McqQuestionType;
  onAnswer: (isCorrect: boolean) => void;
  disabled?: boolean;
  /** Hide stimulus when the parent group already rendered it. */
  hidePassage?: boolean;
  /** Show as already solved (e.g. another part of the same stimulus was wrong). */
  lockedCorrect?: boolean;
  /** Share of students who got this question fully correct (all-time class). */
  classFullyCorrectPercent?: number | null;
  /** Allow multiple attempts (used for wrong-answer practice). */
  allowRetry?: boolean;
  persistedState?: {
    selectedOption?: string | null;
    submitted?: boolean;
  };
  onStateChange?: (state: { selectedOption: string | null; submitted: boolean }) => void;
}

export function McqQuestion({
  question,
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
  allowRetry = false,
  persistedState,
  onStateChange,
}: McqQuestionProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(
    persistedState?.selectedOption ?? null,
  );
  const [submitted, setSubmitted] = useState(Boolean(persistedState?.submitted));

  useEffect(() => {
    if (lockedCorrect) {
      setSubmitted(true);
      setSelectedOption(question.answer);
    }
  }, [lockedCorrect, question.answer]);

  useEffect(() => {
    if (persistedState?.selectedOption !== undefined) {
      setSelectedOption(persistedState.selectedOption);
    }
    if (persistedState?.submitted !== undefined) {
      setSubmitted(persistedState.submitted);
    }
  }, [persistedState?.selectedOption, persistedState?.submitted]);

  useEffect(() => {
    onStateChange?.({ selectedOption, submitted });
  }, [selectedOption, submitted]);

  const handleSelect = (option: string) => {
    const alreadyCorrect = submitted && selectedOption === question.answer;
    if (disabled) return;
    if (submitted && (!allowRetry || alreadyCorrect)) return;
    setSelectedOption(option);
    setSubmitted(true);
    const isCorrect = option === question.answer;
    onAnswer(isCorrect);
  };

  const userWrong = submitted && selectedOption !== question.answer;

  const getOptionClasses = (option: string) => {
    const base =
      "relative flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-all duration-200";

    if (!submitted && !disabled) {
      return cn(
        base,
        "border-border bg-white hover:border-brand-light/60 hover:bg-brand-light/15 cursor-pointer"
      );
    }

    // After submission: never highlight the correct option when the user was wrong
    if (!userWrong && option === question.answer) {
      return cn(base, "border-success/60 bg-success/8 cursor-default");
    }
    if (option === selectedOption && option !== question.answer) {
      return cn(base, "border-danger/60 bg-danger/8 cursor-default");
    }
    return cn(base, "border-border/40 bg-white/30 opacity-60 cursor-default");
  };

  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  return (
    <div className="space-y-5">
      {/* Question header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            {getQuestionTypeLabel(question.type)}
          </Badge>
          {question.topic && (
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              {question.topic}
            </Badge>
          )}
        </div>
        {classFullyCorrectPercent != null && (
          <p className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground">
            <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            {classFullyCorrectPercent}% got this correct
          </p>
        )}
      </div>

      {!hidePassage && (() => {
        const stimulus = collectStimulusFromQuestion(question);
        if (hasVisibleStimulus(stimulus)) {
          return (
            <PassageBlock
              passage={stripQuestionHeadingFromPassage(stimulus.passage)}
              imageUrls={stimulus.imageUrls}
            />
          );
        }
        if (question.imageUrls?.length) {
          return (
            <QuestionImageGrid urls={question.imageUrls} title="Question figures & images" />
          );
        }
        return null;
      })()}

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {displayMarks(question.marks, question.type)}{" "}
        {displayMarks(question.marks, question.type) === 1 ? "mark" : "marks"}
      </p>
      <div className="font-display text-[1.18rem] leading-relaxed text-foreground sm:text-[1.45rem]">
        <RichQuestionContent
          text={stripQuestionNumberPrefix(question.question)}
          className="prose prose-base max-w-none prose-p:my-0"
        />
      </div>

      {/* Options grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleSelect(option)}
            disabled={submitted || disabled}
            className={getOptionClasses(option)}
          >
            {/* Option letter badge */}
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                submitted &&
                  !userWrong &&
                  option === question.answer
                  ? "bg-success text-white"
                  : submitted &&
                      option === selectedOption &&
                      option !== question.answer
                    ? "bg-danger text-white"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {optionLabels[index]}
            </span>

            {/* Option text (render math) */}
            <span className="flex-1 pt-0.5">
              <RichQuestionContent text={option} className="prose prose-base max-w-none prose-p:my-0" />
            </span>

            {/* Result icon */}
            {submitted && !userWrong && option === question.answer && (
              <CheckCircle2 className="size-5 shrink-0 text-success" />
            )}
            {submitted &&
              option === selectedOption &&
              option !== question.answer && (
                <XCircle className="size-5 shrink-0 text-danger" />
              )}
          </button>
        ))}
      </div>

      {/* Feedback message */}
      {submitted && (
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm font-medium",
            selectedOption === question.answer
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          )}
        >
          {selectedOption === question.answer
            ? "Correct! Well done."
            : "Not quite — that wasn\u2019t the right choice."}
        </div>
      )}

      {submitted && (
        <QuestionImageGrid
          urls={question.answerImageUrls}
          title="Solution / marking scheme"
        />
      )}
    </div>
  );
}
