import { useState } from "react";
import { cn, normalizeAnswer, getQuestionTypeLabel } from "@/lib/utils";
import type { ShortQuestion as ShortQuestionType } from "@/lib/subjects";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { CheckCircle2, XCircle, Send } from "lucide-react";

interface ShortQuestionProps {
  question: ShortQuestionType;
  onAnswer: (isCorrect: boolean) => void;
  disabled?: boolean;
}

export function ShortQuestion({
  question,
  onAnswer,
  disabled = false,
}: ShortQuestionProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    if (!answer.trim() || submitted || disabled) return;

    const normalized = normalizeAnswer(answer);
    const correct = question.acceptedAnswers.some(
      (accepted) => normalizeAnswer(accepted) === normalized
    );

    setIsCorrect(correct);
    setSubmitted(true);
    onAnswer(correct);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

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
      </div>

      <PassageBlock passage={question.passage} />
      <QuestionImageGrid urls={question.imageUrls} />

      <h3 className="font-display text-lg leading-relaxed text-foreground sm:text-xl">
        {question.question}
      </h3>

      {/* Guidance */}
      {question.guidance && (
        <div className="rounded-lg bg-amber/10 px-4 py-3 text-sm text-amber">
          {question.guidance}
        </div>
      )}

      {/* Answer input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer..."
            disabled={submitted || disabled}
            className={cn(
              "flex-1 bg-white/60 text-base",
              submitted && isCorrect && "border-success/60 bg-success/5",
              submitted && !isCorrect && "border-danger/60 bg-danger/5"
            )}
          />
          <Button
            onClick={handleSubmit}
            disabled={!answer.trim() || submitted || disabled}
            className="shrink-0 gap-2 bg-brand hover:bg-brand-dark"
          >
            <Send className="size-4" />
            Submit
          </Button>
        </div>

        {/* Feedback */}
        {submitted && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              isCorrect
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            )}
          >
            {isCorrect ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            )}
            <div>
              {isCorrect ? (
                <span className="font-medium">Correct! Well done.</span>
              ) : (
                <div className="space-y-1">
                  <span className="font-medium">Incorrect.</span>
                  <p className="text-danger/80">
                    Accepted answers:{" "}
                    <span className="font-medium">
                      {question.acceptedAnswers.join(", ")}
                    </span>
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
