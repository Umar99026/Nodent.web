import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { cn } from "@/lib/utils";

export type AiMarkPartResult = {
  index: number;
  correct: boolean;
  correctAnswer?: string;
  studentAnswerRead?: string;
  partFeedback?: string;
};

export type AiMarkingFeedbackPanelProps = {
  feedback: string;
  correct?: boolean;
  correctAnswers?: string[];
  partResults?: AiMarkPartResult[];
  partLabels?: string[];
  className?: string;
};

const SMART_MARKING_LABEL = "Smart marking";

/** Split model feedback into separate bullet lines (handles one-line • • • output). */
export function parseMarkingBulletLines(text: string): string[] {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: string[] = [];
  for (const line of lines) {
    if (line.includes("•")) {
      for (const chunk of line.split(/\s*•\s+/)) {
        const part = chunk.trim();
        if (part) items.push(part);
      }
    } else {
      const stripped = line.replace(/^[-–]\s+/, "").trim();
      if (stripped) items.push(stripped);
    }
  }

  return items.length ? items : [trimmed];
}

export function SmartMarkingBulletList({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const items = parseMarkingBulletLines(text);
  if (!items.length) return null;

  if (items.length === 1 && !text.includes("•") && !text.includes("\n")) {
    return (
      <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
        {items[0]}
      </p>
    );
  }

  return (
    <ul className={cn("list-none space-y-2 text-xs leading-relaxed text-muted-foreground", className)}>
      {items.map((item, idx) => (
        <li key={idx} className="flex gap-2.5">
          <span className="mt-[0.35em] size-1 shrink-0 rounded-full bg-current opacity-50" aria-hidden />
          <span className="min-w-0 flex-1">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function AnswerLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm font-semibold text-foreground">
        <RichQuestionContent text={value} className="prose prose-sm max-w-none prose-p:my-0" />
      </div>
    </div>
  );
}

/** Inline feedback shown directly under a multipart answer field (draw mode). */
export function AiMarkingPartFeedback({
  partResult,
  expectedAnswer,
  className,
}: {
  partResult?: AiMarkPartResult;
  expectedAnswer?: string;
  className?: string;
}) {
  const correct = partResult?.correct;
  const feedback = String(partResult?.partFeedback ?? "").trim();
  const studentRead = String(partResult?.studentAnswerRead ?? "").trim();
  const correctAnswer =
    String(partResult?.correctAnswer ?? "").trim() || String(expectedAnswer ?? "").trim();
  const interpretationShownInFeedback = Boolean(
    studentRead && feedback.includes(studentRead),
  );

  if (!feedback && !studentRead && !correctAnswer && correct === undefined) return null;

  return (
    <div
      className={cn(
        "mt-2 space-y-2.5 rounded-lg border px-3 py-2.5 text-sm",
        correct === true && "border-success/25 bg-success/5 text-foreground",
        correct === false && "border-danger/20 bg-danger/[0.04] text-muted-foreground",
        correct === undefined && "border-black/10 bg-black/[0.02] text-muted-foreground",
        className,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
        {SMART_MARKING_LABEL}
      </p>
      {studentRead && !interpretationShownInFeedback ? (
        <AnswerLine label="We interpreted your drawing as" value={studentRead} />
      ) : null}
      {feedback ? (
        <SmartMarkingBulletList text={feedback} />
      ) : correct === false && correctAnswer ? (
        <SmartMarkingBulletList
          text={`• Check your method and final answer.\n• Correct answer: ${correctAnswer}`}
        />
      ) : correct === true ? (
        <SmartMarkingBulletList text="• Your working and answer look correct." />
      ) : null}
      {correct === false && correctAnswer && feedback ? (
        <AnswerLine label="Correct answer" value={correctAnswer} />
      ) : null}
    </div>
  );
}

export function AiMarkingFeedbackPanel({
  feedback,
  correct,
  correctAnswers = [],
  partResults = [],
  partLabels = [],
  className,
}: AiMarkingFeedbackPanelProps) {
  const isWrong = correct === false;

  const wrongParts = (() => {
    if (!isWrong) return [];
    if (partResults.length > 0) {
      return partResults
        .filter((p) => !p.correct)
        .map((p) => ({
          ...p,
          correctAnswer: p.correctAnswer ?? correctAnswers[p.index],
        }))
        .filter((p) => p.correctAnswer || p.studentAnswerRead || p.partFeedback);
    }
    if (correctAnswers.length > 0) {
      return correctAnswers.map((ans, index) => ({
        index,
        correct: false,
        correctAnswer: ans,
        studentAnswerRead: undefined,
        partFeedback: undefined,
      }));
    }
    return [];
  })();

  const showSingleCorrect =
    isWrong &&
    correctAnswers.length > 0 &&
    (wrongParts.length <= 1 && partResults.length <= 1 || (wrongParts.length === 0 && !feedback.trim()));

  if (!feedback.trim() && !showSingleCorrect && wrongParts.length === 0) {
    if (!(isWrong && correctAnswers.length > 0)) return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-black/10 bg-black/[0.02] px-4 py-3 text-sm text-muted-foreground",
        className,
      )}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
        {SMART_MARKING_LABEL}
      </p>
      {feedback.trim() ? <SmartMarkingBulletList text={feedback} className="text-sm" /> : null}

      {showSingleCorrect ? (
        <div className={cn(feedback.trim() && "mt-3 border-t border-black/10 pt-3")}>
          <AnswerLine
            label={correctAnswers.length > 1 ? "Correct answers" : "Correct answer"}
            value={correctAnswers.join(" · ")}
          />
        </div>
      ) : null}

      {wrongParts.length > 1 || (wrongParts.length === 1 && partResults.length > 1) ? (
        <div className={cn((feedback.trim() || showSingleCorrect) && "mt-3 space-y-3 border-t border-black/10 pt-3")}>
          {wrongParts.map((part) => {
            const label = partLabels[part.index]?.trim() || `Part ${part.index + 1}`;
            return (
              <div key={part.index} className="space-y-2 rounded-md bg-white/60 px-3 py-2">
                <p className="text-xs font-semibold text-foreground">{label}</p>
                {part.studentAnswerRead ? (
                  <AnswerLine label="We interpreted your drawing as" value={part.studentAnswerRead} />
                ) : null}
                {part.correctAnswer ? (
                  <AnswerLine label="Correct answer" value={part.correctAnswer} />
                ) : null}
                {part.partFeedback ? <SmartMarkingBulletList text={part.partFeedback} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
