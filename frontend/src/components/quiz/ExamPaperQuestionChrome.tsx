import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function ExamPaperQuestionHeading({
  questionNumber,
  marks,
  className,
}: {
  questionNumber: number;
  marks: number;
  className?: string;
}) {
  void questionNumber;
  const m = Math.max(1, Math.round(marks));
  return (
    <p
      className={cn(
        "vce-question-paper__heading m-0 leading-snug text-[#0b0f19]",
        className,
      )}
    >
      {m} {m === 1 ? "mark" : "marks"}
    </p>
  );
}

export function ExamPaperQuestionBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("vce-question-paper__body", className)}>{children}</div>;
}

export function ExamPaperStem({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <ExamPaperQuestionBody className={className}>
      <RichQuestionContent
        text={text}
        preferMarkdown
        examPaperMode
        className="vce-question-paper__prose max-w-none"
      />
    </ExamPaperQuestionBody>
  );
}

export function ExamPaperPartPrompt({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  const markerMatch = text.trim().match(/^([a-z][).])\s+([\s\S]+)$/i);
  return (
    <div className={cn("vce-question-paper__part-prompt", className)}>
      {markerMatch ? (
        <p className="m-0 leading-[1.45]">
          <span className="vce-question-paper__part-marker">{markerMatch[1]}</span>{" "}
          <RichQuestionContent
            text={markerMatch[2]}
            preferMarkdown
            examPaperMode
            className="vce-question-paper__prose inline max-w-none [&_p]:inline"
          />
        </p>
      ) : (
        <RichQuestionContent
          text={text}
          preferMarkdown
          examPaperMode
          className="vce-question-paper__prose max-w-none"
        />
      )}
    </div>
  );
}
