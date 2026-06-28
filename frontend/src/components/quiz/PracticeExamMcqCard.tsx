import { McqQuestion } from "@/components/quiz/McqQuestion";
import { normalizeMcqLetter } from "@/lib/practiceExamImport";
import {
  mcqItemHasText,
  practiceExamMcqToQuestion,
} from "@/lib/practiceExamMcq";
import type { McqOptionLetter, PracticeExamMcqItem } from "@/lib/practiceExamTypes";
import { MCQ_OPTION_LETTERS } from "@/lib/practiceExamTypes";
import { resolveQuestionImageSrc } from "@/lib/practiceQuestions";
import { cn } from "@/lib/utils";

type Props = {
  item: PracticeExamMcqItem;
  selectedLetter?: string | null;
  onSelectLetter?: (letter: McqOptionLetter) => void;
  disabled?: boolean;
  submitted?: boolean;
  correct?: boolean | null;
  /** Admin preview — highlight the keyed answer in green. */
  showAnswerKey?: boolean;
};

export function PracticeExamMcqCard({
  item,
  selectedLetter = null,
  onSelectLetter,
  disabled = false,
  submitted = false,
  correct = null,
  showAnswerKey = false,
}: Props) {
  if (mcqItemHasText(item)) {
    const letter = (selectedLetter ?? "").toUpperCase();
    const letterIdx = MCQ_OPTION_LETTERS.indexOf(letter as McqOptionLetter);
    const selectedOption = letterIdx >= 0 ? item.options?.[letterIdx] ?? null : null;
    const question = practiceExamMcqToQuestion(item);

    return (
      <McqQuestion
        question={question}
        deferFeedback
        controlledSelected={showAnswerKey ? null : selectedOption}
        onSelectOption={
          onSelectLetter
            ? (optionText) => {
                const idx = question.options.indexOf(optionText);
                if (idx < 0) return;
                onSelectLetter(MCQ_OPTION_LETTERS[idx]!);
              }
            : undefined
        }
        revealResults={showAnswerKey || submitted}
        disabled={disabled || showAnswerKey}
        hidePassage={false}
        onAnswer={() => {}}
      />
    );
  }

  const answerLetter = normalizeMcqLetter(item.acceptedAnswer);
  const picked = (selectedLetter ?? "").toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold text-[#0b0f19]">
          Question {item.questionNumber}
        </h3>
        {(item.marks ?? 0) > 0 ? (
          <span className="text-xs text-muted-foreground">
            {item.marks} mark{(item.marks ?? 1) === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {item.stimulusImageUrl?.trim() ? (
        <div className="overflow-hidden rounded-xl border border-black/10 bg-white">
          <img
            src={resolveQuestionImageSrc(item.stimulusImageUrl)}
            alt={`Question ${item.questionNumber}`}
            className="block w-full object-contain"
            draggable={false}
            decoding="async"
          />
        </div>
      ) : null}

      <div className="flex justify-center gap-2 sm:gap-3">
        {MCQ_OPTION_LETTERS.map((letter) => {
          const isPicked = picked === letter;
          const isKey = answerLetter === letter;
          const showResult = submitted && !showAnswerKey;
          const interactive = Boolean(onSelectLetter) && !disabled && !submitted;

          return (
            <button
              key={letter}
              type="button"
              disabled={!interactive}
              aria-label={`Option ${letter}`}
              aria-pressed={isPicked}
              onClick={() => onSelectLetter?.(letter)}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border-2 text-sm font-bold shadow-sm transition-colors sm:size-12",
                interactive &&
                  !isPicked &&
                  "border-black/20 bg-white hover:border-brand hover:bg-brand/5",
                interactive && isPicked && "border-brand bg-brand text-white",
                showResult &&
                  isPicked &&
                  correct === true &&
                  "border-success bg-success text-white",
                showResult &&
                  isPicked &&
                  correct === false &&
                  "border-danger bg-danger text-white",
                showResult && !isPicked && isKey && "border-success/50 bg-success/10 text-success",
                showAnswerKey && isKey && "border-success bg-success text-white",
                showAnswerKey && !isKey && "border-black/15 bg-white text-muted-foreground",
                !interactive &&
                  !showResult &&
                  !showAnswerKey &&
                  "border-black/15 bg-white/80 text-muted-foreground",
              )}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
