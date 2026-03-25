import { useState } from "react";
import { cn, getQuestionTypeLabel } from "@/lib/utils";
import type { McqQuestion as McqQuestionType } from "@/lib/subjects";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";

interface McqQuestionProps {
  question: McqQuestionType;
  onAnswer: (isCorrect: boolean) => void;
  disabled?: boolean;
}

function QuestionImages({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {urls.slice(0, 4).map((src) => (
        <div
          key={src}
          className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"
        >
          <img
            src={src}
            alt="Question image"
            className="h-44 w-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

export function McqQuestion({
  question,
  onAnswer,
  disabled = false,
}: McqQuestionProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSelect = (option: string) => {
    if (submitted || disabled) return;
    setSelectedOption(option);
    setSubmitted(true);
    const isCorrect = option === question.answer;
    onAnswer(isCorrect);
  };

  const getOptionClasses = (option: string) => {
    const base =
      "relative flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-all duration-200";

    if (!submitted && !disabled) {
      return cn(
        base,
        "border-border bg-white/60 hover:border-brand-light hover:bg-brand/5 cursor-pointer"
      );
    }

    // After submission
    if (option === question.answer) {
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
        <h3 className="font-display text-lg leading-relaxed text-foreground sm:text-xl">
          {question.question}
        </h3>
      </div>

      <QuestionImages urls={question.imageUrls} />

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
                submitted && option === question.answer
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

            {/* Option text */}
            <span className="flex-1 pt-0.5">{option}</span>

            {/* Result icon */}
            {submitted && option === question.answer && (
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
            : `Incorrect. The correct answer is: ${question.answer}`}
        </div>
      )}
    </div>
  );
}
