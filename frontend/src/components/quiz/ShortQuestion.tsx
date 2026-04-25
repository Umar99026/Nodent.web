import { useState, useEffect } from "react";
import { cn, normalizeAnswer, getQuestionTypeLabel } from "@/lib/utils";
import type { ShortQuestion as ShortQuestionType } from "@/lib/subjects";
import { displayMarks, stripQuestionHeadingFromPassage, stripQuestionNumberPrefix } from "@/lib/questionDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { CheckCircle2, XCircle, Send } from "lucide-react";

interface ShortQuestionProps {
  question: ShortQuestionType;
  onAnswer: (isCorrect: boolean) => void;
  disabled?: boolean;
  hidePassage?: boolean;
  lockedCorrect?: boolean;
  classFullyCorrectPercent?: number | null;
}

export function ShortQuestion({
  question,
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
}: ShortQuestionProps) {
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  useEffect(() => {
    if (lockedCorrect) {
      setSubmitted(true);
      setIsCorrect(true);
      setAnswer(question.acceptedAnswers[0] ?? "—");
    }
  }, [lockedCorrect, question]);

  const canSubmit = !!answer.trim() && !submitted && !disabled;

  const handleSubmit = () => {
    if (!canSubmit) return;

    let correct = false;
    if (answer.trim()) {
      const normalized = normalizeAnswer(answer);
      correct = question.acceptedAnswers.some(
        (accepted) => normalizeAnswer(accepted) === normalized,
      );
    }

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
        {classFullyCorrectPercent != null && (
          <p className="text-xs tabular-nums text-muted-foreground">
            Class fully correct: {classFullyCorrectPercent}%
          </p>
        )}
      </div>

      {!hidePassage && <PassageBlock passage={stripQuestionHeadingFromPassage(question.passage)} />}
      <QuestionImageGrid urls={question.imageUrls} title="Question figures & images" />

      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {displayMarks(question.marks, question.type)}{" "}
        {displayMarks(question.marks, question.type) === 1 ? "mark" : "marks"}
      </p>
      <div className="font-display text-lg leading-relaxed text-foreground sm:text-xl">
        <RichQuestionContent
          text={stripQuestionNumberPrefix(question.question)}
          className="prose prose-sm max-w-none prose-p:my-0"
        />
      </div>

      {/* Guidance */}
      {question.guidance && (
        <div className="rounded-lg bg-amber/10 px-4 py-3 text-sm text-amber">
          <RichQuestionContent text={question.guidance} className="prose prose-sm max-w-none prose-p:my-0" />
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
            disabled={!canSubmit}
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
              isCorrect ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
            )}
          >
            {isCorrect ? (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <div>
                  <span className="font-medium">Correct! Well done.</span>
                </div>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <div>
                  <span className="font-medium">
                    Not quite — keep working on this one.
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {submitted && (
        <QuestionImageGrid
          urls={question.answerImageUrls}
          title="Solution / marking scheme"
        />
      )}
    </div>
  );
}
