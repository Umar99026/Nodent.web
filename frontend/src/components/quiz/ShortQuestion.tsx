import { useState, useEffect } from "react";
import { cn, getQuestionTypeLabel, isAnswerCorrect } from "@/lib/utils";
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
  /** Allow multiple attempts (used for wrong-answer practice). */
  allowRetry?: boolean;
}

function detectMultipartLabels(questionText: string): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  const parenLabelRegex = /(^|[\s,;:])\(\s*(i|ii|iii|iv|v|vi|vii|viii|ix|x|[a-z]|[1-9])\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = parenLabelRegex.exec(questionText)) != null) {
    const raw = String(match[2] || "").toLowerCase();
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    labels.push(raw);
  }

  if (labels.length >= 2) return labels;

  const looksLikeStatsTriple =
    /(?:^|[^a-z])E\s*\([^)]*\)/i.test(questionText) &&
    /sd\s*\([^)]*\)/i.test(questionText) &&
    /(?:Pr|P)\s*\([^)]*\)/i.test(questionText);
  if (looksLikeStatsTriple) return ["i", "ii", "iii"];

  const hasPartI = /(?:\(\s*i\s*\)|\bi\s*[).:])/i.test(questionText);
  const hasPartII = /(?:\(\s*ii\s*\)|\bii\s*[).:])/i.test(questionText);
  const hasPartIII = /(?:\(\s*iii\s*\)|\biii\s*[).:])/i.test(questionText);
  if (hasPartI && hasPartII && hasPartIII) return ["i", "ii", "iii"];
  if (hasPartI && hasPartII) return ["i", "ii"];

  const directiveParts = parseDirectiveParts(questionText);
  if (directiveParts.length >= 2) {
    return directiveParts.map((_, idx) => `part${idx + 1}`);
  }

  return [];
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectMultipartDescriptors(questionText: string, labels: string[]): string[] {
  const eToken = questionText.match(/\bE\s*\([^)]*\)/i)?.[0]?.replace(/\s+/g, "");
  const sdToken = questionText.match(/\bsd\s*\([^)]*\)/i)?.[0]?.replace(/\s+/g, "");
  const prToken = questionText.match(/\b(?:Pr|P)\s*\([^)]*\)/i)?.[0]?.replace(/\s+/g, "");
  if (eToken && sdToken && prToken && labels.length >= 3) {
    return [eToken, sdToken, prToken];
  }

  if (labels.length >= 2 && labels.every((x, i) => x === `part${i + 1}`)) {
    const parts = parseDirectiveParts(questionText);
    if (parts.length >= 2) return parts;
  }

  return labels.map((label, idx) => {
    const curr = escapeForRegex(label);
    const next = labels.slice(idx + 1).map((x) => escapeForRegex(x));
    const boundary = next.length ? `(?=\\(\\s*(?:${next.join("|")})\\s*\\)|$)` : "(?=$)";
    const re = new RegExp(`\\(\\s*${curr}\\s*\\)\\s*([\\s\\S]*?)${boundary}`, "i");
    const raw = questionText.match(re)?.[1] ?? "";
    const cleaned = raw.replace(/\s+/g, " ").trim().replace(/[;:,.]+$/g, "");
    return cleaned || `${label})`;
  });
}

function parseDirectiveParts(questionText: string): string[] {
  const actionRegex =
    /\b(find|determine|calculate|compute|evaluate|state)\b\s+([\s\S]*?)(?:[.?!]|$)/i;
  const m = questionText.match(actionRegex);
  if (!m?.[2]) return [];
  const body = m[2].replace(/\s+/g, " ").trim();
  if (!body) return [];
  const chunks = body
    .split(/\s*,\s*then\s+|\s+then\s+|\s*,\s*and\s+|\s+and\s+/i)
    .map((x) => x.trim().replace(/^[,;:\-]+/, "").replace(/[;:,.]+$/g, ""))
    .filter(Boolean);
  if (chunks.length < 2) return [];
  return chunks;
}

export function ShortQuestion({
  question,
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
  allowRetry = false,
}: ShortQuestionProps) {
  const [answer, setAnswer] = useState("");
  const [parts, setParts] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [dpHint, setDpHint] = useState<number | null>(null);

  const configuredParts = question.answerParts?.filter((p) => p?.label?.trim()) ?? [];
  const partLabels =
    configuredParts.length >= 2
      ? configuredParts.map((p, idx) => p.key?.trim() || `part${idx + 1}`)
      : detectMultipartLabels(question.question);
  const isMultipart = partLabels.length >= 2;
  const partDescriptors =
    configuredParts.length >= 2
      ? configuredParts.map((p) => p.label.trim())
      : detectMultipartDescriptors(question.question, partLabels);

  useEffect(() => {
    setParts(Array(partLabels.length).fill(""));
  }, [question.question, partLabels.length]);

  useEffect(() => {
    if (lockedCorrect) {
      setSubmitted(true);
      setIsCorrect(true);
      setAnswer(question.acceptedAnswers[0] ?? "—");
      setParts(Array(partLabels.length).fill(""));
    }
  }, [lockedCorrect, question, partLabels.length]);

  const compositeAnswer =
    isMultipart
      ? partLabels.map((label, idx) => `${label}) ${parts[idx] ?? ""}`.trim()).join("; ")
      : answer;

  const canSubmit =
    (isMultipart ? parts.every((p) => p.trim().length > 0) : !!compositeAnswer.trim()) &&
    !disabled &&
    (!submitted || (allowRetry && !isCorrect));

  const handleSubmit = () => {
    if (!canSubmit) return;

    const accepted = question.acceptedAnswers ?? [];
    let correct = false;
    let nextDpHint: number | null = null;

    if (isMultipart) {
      // Prefer per-part grading when accepted answers are provided per part.
      if (accepted.length >= partLabels.length) {
        const gradedParts = partLabels.map((_, idx) =>
          isAnswerCorrect(parts[idx] ?? "", [accepted[idx]]),
        );
        correct = gradedParts.every((g) => g.correct);
        nextDpHint = Math.max(...gradedParts.map((g) => g.dpHint ?? 0)) || null;
      } else {
        const gradedCombined = isAnswerCorrect(compositeAnswer, accepted);
        correct = gradedCombined.correct;
        nextDpHint = gradedCombined.dpHint;
      }
    } else {
      const graded = isAnswerCorrect(compositeAnswer, accepted);
      correct = graded.correct;
      nextDpHint = graded.dpHint;
    }
    setDpHint(nextDpHint);

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
        {dpHint != null && dpHint > 0 ? ` (${dpHint} d.p.)` : ""}
      </p>
      <div className="font-display text-[1.18rem] leading-relaxed text-foreground sm:text-[1.45rem]">
        <RichQuestionContent
          text={stripQuestionNumberPrefix(question.question)}
          className="prose prose-base max-w-none prose-p:my-0"
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
        {isMultipart && (
          <p className="text-xs text-muted-foreground">Answer each part below.</p>
        )}
        <div className="flex gap-2">
          {isMultipart ? (
            <div className="flex flex-1 flex-col gap-2">
              {partLabels.map((label, idx) => (
                <div key={`${label}-${idx}`} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{partDescriptors[idx]}</p>
                  <Input
                    value={parts[idx] ?? ""}
                    onChange={(e) =>
                      setParts((prev) => {
                        const next = [...prev];
                        next[idx] = e.target.value;
                        return next;
                      })
                    }
                    onKeyDown={handleKeyDown}
                    placeholder="Type your answer..."
                    disabled={disabled || (submitted && isCorrect && !allowRetry)}
                    className={cn(
                      "bg-white/60 text-base",
                      submitted && isCorrect && "border-success/60 bg-success/5",
                      submitted && !isCorrect && "border-danger/60 bg-danger/5"
                    )}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your answer..."
              disabled={disabled || (submitted && isCorrect && !allowRetry)}
              className={cn(
                "flex-1 bg-white/60 text-base",
                submitted && isCorrect && "border-success/60 bg-success/5",
                submitted && !isCorrect && "border-danger/60 bg-danger/5"
              )}
            />
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="shrink-0 gap-2 bg-brand hover:bg-brand-dark"
          >
            <Send className="size-4" />
            {submitted && isCorrect ? "Correct" : "Submit"}
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
