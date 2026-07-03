import { SmartMarkingBulletList } from "@/components/quiz/AiMarkingFeedbackPanel";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { isHandwritingValue } from "@/lib/handwritingMode";
import { marksEarnedFromPartResults } from "@/lib/questionDisplay";
import { cn } from "@/lib/utils";
import { buildWrongAnswerBullets } from "@/lib/wrongAnswerFeedback";
import { CheckCircle2, XCircle } from "lucide-react";

type MultipartMarkBreakdownProps = {
  partLabels: string[];
  partResults: Array<boolean | null | undefined>;
  partMarks: number[];
  expectedAnswers: string[];
  studentAnswers?: string[];
  guidance?: string;
  className?: string;
};

export function MultipartMarkBreakdown({
  partLabels,
  partResults,
  partMarks,
  expectedAnswers,
  studentAnswers = [],
  guidance,
  className,
}: MultipartMarkBreakdownProps) {
  const slotCount = Math.max(partResults.length, partMarks.length, expectedAnswers.length);
  if (!slotCount) return null;

  const marks = Array.from({ length: slotCount }, (_, idx) =>
    Math.max(1, Math.round(partMarks[idx] ?? 1)),
  );
  const earned = marksEarnedFromPartResults(partResults, marks);
  const total = marks.reduce((sum, m) => sum + m, 0);
  const allCorrect = partResults.length > 0 && partResults.every((ok) => ok === true);

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border px-4 py-3 text-sm",
        allCorrect ? "border-success/25 bg-success/5" : "border-black/10 bg-black/[0.02]",
        className,
      )}
    >
      <p className="font-semibold text-foreground">
        Mark breakdown: {earned} / {total} {total === 1 ? "mark" : "marks"}
      </p>
      <ul className="space-y-2.5">
        {Array.from({ length: slotCount }, (_, idx) => {
          const ok = partResults[idx] === true;
          const slotMarks = marks[idx] ?? 1;
          const label = partLabels[idx]?.trim() || `Part ${String.fromCharCode(97 + (idx % 26))}`;
          const expected = expectedAnswers[idx]?.trim() ?? "";
          const student = studentAnswers[idx]?.trim() ?? "";
          const wrongBullets =
            !ok && expected && student && !isHandwritingValue(student)
              ? buildWrongAnswerBullets({
                  studentAnswer: student,
                  expectedAnswers: [expected],
                  guidance,
                })
              : [];
          return (
            <li
              key={idx}
              className={cn(
                "rounded-md border px-3 py-2",
                ok ? "border-success/20 bg-white/70" : "border-danger/15 bg-white/70",
              )}
            >
              <div className="flex items-start gap-2">
                {ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-foreground">
                    {label} — {ok ? slotMarks : 0}/{slotMarks}{" "}
                    {slotMarks === 1 ? "mark" : "marks"}
                  </p>
                  {!ok && expected ? (
                    <div className="space-y-2 text-xs text-muted-foreground">
                      {wrongBullets.length ? (
                        <SmartMarkingBulletList
                          text={wrongBullets.map((b) => `• ${b}`).join("\n")}
                        />
                      ) : (
                        <div>
                          <span className="font-medium uppercase tracking-wide">Correct answer</span>
                          <div className="mt-0.5 font-semibold text-foreground">
                            <RichQuestionContent
                              text={expected}
                              className="prose prose-sm max-w-none prose-p:my-0"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
