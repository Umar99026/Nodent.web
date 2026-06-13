import { useState, useEffect } from "react";
import { cn, getQuestionTypeLabel, inferDpHintFromAccepted, isAnswerCorrect } from "@/lib/utils";
import type { ShortQuestion as ShortQuestionType } from "@/lib/subjects";
import {
  buildSmartMarkPayload,
  requestSmartMark,
  shouldUseAiMarking,
} from "@/lib/questionAiMarking";
import {
  collectStimulusFromQuestion,
  displayMarks,
  formatPartDescriptor,
  hasVisibleStimulus,
  marksEarnedFromPartResults,
  normalizePartKey,
  resolvePartMarks,
  resolveMultipartPartDisplay,
  stripQuestionHeadingFromPassage,
  stripQuestionNumberPrefix,
  type AnswerScoreDetail,
} from "@/lib/questionDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { CheckCircle2, XCircle, Send, Loader2 } from "lucide-react";

interface ShortQuestionProps {
  question: ShortQuestionType;
  subjectId?: string;
  questionKey?: string;
  onAnswer: (isCorrect: boolean, detail?: AnswerScoreDetail) => void;
  disabled?: boolean;
  hidePassage?: boolean;
  lockedCorrect?: boolean;
  classFullyCorrectPercent?: number | null;
  /** Allow multiple attempts (used for wrong-answer practice). */
  allowRetry?: boolean;
  /** Practice-only mode (no smart marking API). Used for wrong-answer review. */
  practiceOnly?: boolean;
  persistedState?: {
    answer?: string;
    parts?: string[];
    submitted?: boolean;
    isCorrect?: boolean;
    dpHint?: number | null;
    partResults?: (boolean | null)[];
  };
  onStateChange?: (state: {
    answer: string;
    parts: string[];
    submitted: boolean;
    isCorrect: boolean;
    dpHint: number | null;
    partResults: (boolean | null)[];
  }) => void;
}

function expandAcceptedForMultipart(acceptedPool: string[]): string[] {
  if (acceptedPool.length !== 1) return acceptedPool;
  const raw = String(acceptedPool[0] ?? "").trim();
  if (!raw) return acceptedPool;
  const labelled = raw.match(/(?:^|[;\n])\s*(?:\(?i+\)?|[a-z]|\d+)\)\s*([^;\n]+)/gi);
  if (labelled && labelled.length >= 2) {
    return labelled
      .map((x) => x.replace(/^(?:^|[;\n])\s*(?:\(?i+\)?|[a-z]|\d+)\)\s*/i, "").trim())
      .filter(Boolean);
  }
  const split = raw.split(/\s*;\s*|\s*\n+\s*/).map((x) => x.trim()).filter(Boolean);
  if (split.length >= 2) return split;
  const splitCommaAndAnd = raw
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((x) => x.trim())
    .filter(Boolean);
  return splitCommaAndAnd.length >= 2 ? splitCommaAndAnd : acceptedPool;
}

function cleanAcceptedCandidate(raw: string): string {
  return String(raw ?? "")
    .replace(/^\s*(?:\(?i+\)?|[a-z]|\d+)\)\s*/i, "")
    .trim();
}

function formatExpectedAnswer(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    if (typeof row.answer === "string" && row.answer.trim()) return row.answer.trim();
    if (typeof row.value === "string" && row.value.trim()) return row.value.trim();
    if (typeof row.label === "string" && row.label.trim()) return row.label.trim();
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value ?? "");
}

function inferUnitHint(text: string): string | null {
  const t = String(text ?? "").toLowerCase();
  if (/%/.test(t) || /\b(percent|percentage|rate|ear|effective annual rate)\b/i.test(t)) return "%";
  if (/\bkm\b/i.test(t) || /\bdistance\b/i.test(t)) return "km";
  if (/\bdays?\b/i.test(t)) return "days";
  if (/\bweeks?\b/i.test(t)) return "weeks";
  if (/\bmonths?\b/i.test(t)) return "months";
  if (/\$(?!\s*%)/.test(t) || /\b(price|cost|balance|residual|repayment|loan|dollar)\b/i.test(t)) return "$";
  return null;
}

function inferPartUnitHint(
  descriptor: string,
  expectedAnswer: string | undefined,
): string | null {
  const fromDescriptor = inferUnitHint(descriptor);
  if (fromDescriptor) return fromDescriptor;
  const fromExpected = inferUnitHint(expectedAnswer ?? "");
  if (fromExpected) return fromExpected;
  return null;
}

function gradeMultipartIndividually(parts: string[], acceptedPool: string[]) {
  const expandedAccepted = expandAcceptedForMultipart(acceptedPool).map(cleanAcceptedCandidate);
  const byPosition =
    expandedAccepted.length >= parts.length
      ? parts.map((part, idx) => isAnswerCorrect((part ?? "").trim(), [expandedAccepted[idx]]))
      : null;
  if (byPosition) return byPosition;
  const partGrades = parts.map((part) => {
    const trimmed = (part ?? "").trim();
    if (!trimmed) return { correct: false, dpHint: null as number | null };
    for (let i = 0; i < expandedAccepted.length; i += 1) {
      const graded = isAnswerCorrect(trimmed, [expandedAccepted[i]]);
      if (graded.correct) {
        return graded;
      }
    }
    const fallback = expandedAccepted[0] ? isAnswerCorrect(trimmed, [expandedAccepted[0]]) : null;
    return { correct: false, dpHint: fallback?.dpHint ?? null };
  });
  return partGrades;
}

function detectMultipartLabels(questionText: string): string[] {
  // Multipart answer UI is disabled: always render a single answer input.
  void questionText;
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
    const letter = normalizePartKey(label, idx);
    const curr = escapeForRegex(label);
    const next = labels.slice(idx + 1).map((x) => escapeForRegex(x));
    const boundary = next.length ? `(?=\\(\\s*(?:${next.join("|")})\\s*\\)|$)` : "(?=$)";
    const re = new RegExp(`\\(\\s*${curr}\\s*\\)\\s*([\\s\\S]*?)${boundary}`, "i");
    const raw = questionText.match(re)?.[1] ?? "";
    const cleaned = raw.replace(/\s+/g, " ").trim().replace(/[;:,.]+$/g, "");
    return cleaned ? formatPartDescriptor(letter, cleaned) : `${letter})`;
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
  subjectId = "",
  questionKey = "",
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
  allowRetry = false,
  practiceOnly = false,
  persistedState,
  onStateChange,
}: ShortQuestionProps) {
  const [answer, setAnswer] = useState(persistedState?.answer ?? "");
  const [parts, setParts] = useState<string[]>(persistedState?.parts ?? []);
  const [submitted, setSubmitted] = useState(Boolean(persistedState?.submitted));
  const [isCorrect, setIsCorrect] = useState(Boolean(persistedState?.isCorrect));
  const [dpHint, setDpHint] = useState<number | null>(persistedState?.dpHint ?? null);
  const [partResults, setPartResults] = useState<(boolean | null)[]>(persistedState?.partResults ?? []);
  const [aiMarking, setAiMarking] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);

  const configuredParts: ShortQuestionType["answerParts"] =
    question.answerParts?.filter((p) => p?.label?.trim()) ?? [];
  const configuredDisplay =
    configuredParts.length >= 2 ? resolveMultipartPartDisplay(configuredParts) : null;
  const partLabels = configuredDisplay
    ? configuredDisplay.letters
    : detectMultipartLabels(question.question);
  const isMultipart = configuredParts.length >= 2 || partLabels.length >= 2;
  const baseMarks = displayMarks(question.marks, question.type);
  const partMarks = isMultipart
    ? resolvePartMarks(configuredParts, partLabels.length, baseMarks)
    : [];
  const effectiveTotalMarks = isMultipart
    ? partMarks.reduce((sum, m) => sum + m, 0)
    : baseMarks;
  const hasExplicitPartMarks =
    isMultipart &&
    configuredParts.length >= 2 &&
    configuredParts.every((p) => typeof p.marks === "number" && (p.marks ?? 0) > 0);
  const partDescriptors = configuredDisplay
    ? configuredDisplay.descriptors
    : detectMultipartDescriptors(question.question, partLabels);
  const partPlaceholders =
    configuredParts.length >= 2
      ? configuredParts.map((p) => p.placeholder?.trim() || "")
      : [];
  const partImageUrls =
    configuredParts.length >= 2
      ? configuredParts.map((p) => p.imageUrl?.trim() || "")
      : [];
  const expectedAnswersForDisplay = isMultipart
    ? expandAcceptedForMultipart(question.acceptedAnswers ?? [])
        .map(formatExpectedAnswer)
        .map(cleanAcceptedCandidate)
    : (question.acceptedAnswers ?? []).map(formatExpectedAnswer);
  const partDpHints = isMultipart
    ? partLabels.map((_, idx) =>
        inferDpHintFromAccepted([expectedAnswersForDisplay[idx] ?? ""]),
      )
    : [];
  const singleDpHint = !isMultipart
    ? inferDpHintFromAccepted([expectedAnswersForDisplay[0] ?? ""])
    : null;

  const useSmartMarking = shouldUseAiMarking({
    questionText: question.question,
    partLabels: partDescriptors,
    acceptedAnswers: question.acceptedAnswers,
    questionType: question.type,
  });

  const useTextArea = useSmartMarking && !isMultipart;

  useEffect(() => {
    onStateChange?.({
      answer,
      parts,
      submitted,
      isCorrect,
      dpHint,
      partResults,
    });
  }, [answer, parts, submitted, isCorrect, dpHint, partResults]);

  useEffect(() => {
    if (lockedCorrect) {
      setSubmitted(true);
      setIsCorrect(true);
      setAnswer(question.acceptedAnswers[0] ?? "—");
      setParts(Array(partLabels.length).fill(""));
      setPartResults(Array(partLabels.length).fill(true));
    }
  }, [lockedCorrect, question, partLabels.length]);

  const compositeAnswer =
    isMultipart
      ? partLabels.map((label, idx) => `${label}) ${parts[idx] ?? ""}`.trim()).join("; ")
      : answer;

  const canSubmit =
    (isMultipart ? parts.every((p) => p.trim().length > 0) : !!compositeAnswer.trim()) &&
    !disabled &&
    !aiMarking &&
    (!submitted || (allowRetry && !isCorrect));

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const accepted = question.acceptedAnswers ?? [];
    let correct = false;
    let nextDpHint: number | null = null;
    let partCorrectFlags: boolean[] = [];

    if (isMultipart) {
      const gradedParts = gradeMultipartIndividually(parts, accepted);
      partCorrectFlags = gradedParts.map((g) => g.correct);
      setPartResults(partCorrectFlags);
      correct = partCorrectFlags.every(Boolean);
      nextDpHint = Math.max(...gradedParts.map((g) => g.dpHint ?? 0)) || null;
    } else {
      setPartResults([]);
      const graded = isAnswerCorrect(compositeAnswer, accepted);
      correct = graded.correct;
      nextDpHint = graded.dpHint;
    }
    setDpHint(nextDpHint);

    let finalCorrect = correct;

    if (
      useSmartMarking &&
      !practiceOnly &&
      subjectId &&
      questionKey &&
      !correct
    ) {
      setAiMarking(true);
      try {
        const responseText = isMultipart
          ? partLabels.map((label, idx) => `${label}) ${parts[idx] ?? ""}`.trim()).join("\n")
          : compositeAnswer;
        const ai = await requestSmartMark(subjectId, questionKey, {
          responseText,
          studentParts: isMultipart ? parts : undefined,
          question: buildSmartMarkPayload(question, {
            marks: effectiveTotalMarks,
            partDescriptors,
            partMarks,
            expectedAnswers: expectedAnswersForDisplay,
            configuredParts,
          }),
        });
        if (ai) {
          finalCorrect = ai.correct;
          setAiFeedback(ai.feedback || null);
          if (ai.partResults?.length) {
            partCorrectFlags = partLabels.map((_, idx) => {
              const hit = ai.partResults?.find((p) => p.index === idx);
              return hit ? hit.correct : false;
            });
            setPartResults(partCorrectFlags);
          }
        }
      } finally {
        setAiMarking(false);
      }
    }

    setIsCorrect(finalCorrect);
    setSubmitted(true);
    const earned = isMultipart
      ? marksEarnedFromPartResults(partCorrectFlags, partMarks)
      : finalCorrect
        ? effectiveTotalMarks
        : 0;
    onAnswer(finalCorrect, { marksEarned: earned, marksTotal: effectiveTotalMarks });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isMultipart) return;
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
            <QuestionImageGrid urls={question.imageUrls} title="Source material" />
          );
        }
        return null;
      })()}

      {!isMultipart || !hasExplicitPartMarks ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {effectiveTotalMarks}{" "}
          {effectiveTotalMarks === 1 ? "mark" : "marks"}
          {dpHint != null && dpHint > 0 ? ` (${dpHint} d.p.)` : ""}
        </p>
      ) : null}
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
        {useSmartMarking ? (
          <p className="text-xs text-muted-foreground">
            Smart marking — write in full sentences where needed.
          </p>
        ) : null}
        {isMultipart && (
          <p className="text-xs text-muted-foreground">
            Answer each part below, then submit once to mark all parts.
          </p>
        )}
        {isMultipart ? (
            <div className="flex flex-col gap-3">
              {partLabels.map((label, idx) => (
                <div key={`${label}-${idx}`} className="space-y-1">
                  {(() => {
                    const partUnit = inferPartUnitHint(
                      partDescriptors[idx] ?? "",
                      expectedAnswersForDisplay[idx],
                    );
                    return (
                      <>
                  {partImageUrls[idx] ? (
                    <QuestionImageGrid urls={[partImageUrls[idx]!]} />
                  ) : null}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">{partDescriptors[idx]}</p>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {partMarks[idx]} {partMarks[idx] === 1 ? "mark" : "marks"}
                    </span>
                  </div>
                  {submitted && (
                    <p
                      className={cn(
                        "text-[11px] font-semibold",
                        partResults[idx] === true ? "text-success" : "text-danger",
                      )}
                    >
                      {partResults[idx] === true ? "Correct" : "Incorrect"}
                    </p>
                  )}
                  <div className="flex items-stretch">
                    {partUnit ? (
                      <span className="inline-flex items-center rounded-l-md border border-r-0 border-black/15 bg-muted px-2 text-xs font-semibold text-muted-foreground">
                        {partUnit}
                      </span>
                    ) : null}
                    {shouldUseAiMarking({
                      questionText: partDescriptors[idx] ?? "",
                      acceptedAnswers: [expectedAnswersForDisplay[idx] ?? ""],
                      questionType: "short",
                    }) ? (
                      <Textarea
                        value={parts[idx] ?? ""}
                        onChange={(e) =>
                          setParts((prev) => {
                            const next = [...prev];
                            next[idx] = e.target.value;
                            return next;
                          })
                        }
                        placeholder={partPlaceholders[idx] || "Write your answer…"}
                        disabled={disabled || (submitted && !allowRetry)}
                        rows={3}
                        className={cn(
                          "bg-white/60 text-sm",
                          submitted && isCorrect && "border-success/60 bg-success/5",
                          submitted && !isCorrect && "border-danger/60 bg-danger/5",
                        )}
                      />
                    ) : (
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
                        placeholder={partPlaceholders[idx] || "Type your answer…"}
                        disabled={disabled || (submitted && !allowRetry)}
                        className={cn(
                          "bg-white/60 text-base",
                          partUnit && "rounded-l-none",
                          submitted && isCorrect && "border-success/60 bg-success/5",
                          submitted && !isCorrect && "border-danger/60 bg-danger/5",
                        )}
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      {partDpHints[idx] === 2
                        ? "Answer to 2 d.p."
                        : partDpHints[idx] === 0
                          ? "Whole number (no decimals)"
                          : "Any valid format"}
                    </span>
                  </div>
                  {submitted && partResults[idx] === false && (
                    <p className="text-[11px] text-muted-foreground">
                      Correct answer:{" "}
                      <span className="font-semibold text-foreground">
                        {expectedAnswersForDisplay[idx] ?? "—"}
                      </span>
                    </p>
                  )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {configuredParts.length === 1 && configuredParts[0]!.label.trim() ? (
                <p className="text-xs font-medium text-muted-foreground">
                  {configuredParts[0]!.label.trim()}
                </p>
              ) : null}
              <div className={cn("flex gap-2", useTextArea ? "flex-col" : "items-stretch")}>
                <div className={cn("flex flex-1 items-stretch", useTextArea && "w-full")}>
                  {!useTextArea && inferPartUnitHint("", expectedAnswersForDisplay[0]) ? (
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-black/15 bg-muted px-2 text-xs font-semibold text-muted-foreground">
                      {inferPartUnitHint("", expectedAnswersForDisplay[0])}
                    </span>
                  ) : null}
                  {useTextArea ? (
                    <Textarea
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      placeholder="Write your answer…"
                      disabled={disabled || (submitted && !allowRetry)}
                      rows={5}
                      className={cn(
                        "bg-white/60 text-sm leading-relaxed",
                        submitted && isCorrect && "border-success/60 bg-success/5",
                        submitted && !isCorrect && "border-danger/60 bg-danger/5",
                      )}
                    />
                  ) : (
                    <Input
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type your answer..."
                      disabled={disabled || (submitted && !allowRetry)}
                      className={cn(
                        "flex-1 bg-white/60 text-base",
                        inferPartUnitHint("", expectedAnswersForDisplay[0]) && "rounded-l-none",
                        submitted && isCorrect && "border-success/60 bg-success/5",
                        submitted && !isCorrect && "border-danger/60 bg-danger/5",
                      )}
                    />
                  )}
                </div>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className={cn(
                    "shrink-0 gap-2 btn-accent",
                    useTextArea && "w-full sm:w-auto",
                  )}
                >
                  {aiMarking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  {aiMarking
                    ? "Marking…"
                    : submitted && isCorrect
                      ? "Correct"
                      : "Submit"}
                </Button>
              </div>
              {!useTextArea ? (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {singleDpHint === 2
                    ? "Answer to 2 d.p."
                    : singleDpHint === 0
                      ? "Whole number (no decimals)"
                      : "Any valid format"}
                </span>
              </div>
              ) : null}
              {submitted && !isCorrect && allowRetry && !useSmartMarking && (
                <p className="text-[11px] text-muted-foreground">
                  Correct answer:{" "}
                  <span className="text-[13px] font-semibold text-foreground">
                    {expectedAnswersForDisplay[0] ?? "—"}
                  </span>
                </p>
              )}
            </div>
          )}

        {isMultipart ? (
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="btn-accent w-full gap-2 sm:w-auto"
          >
            {aiMarking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {aiMarking
              ? "Marking…"
              : submitted
                ? isCorrect
                  ? "All parts correct"
                  : "Submitted"
                : "Submit all parts"}
          </Button>
        ) : null}

        {/* Feedback */}
        {submitted && isMultipart && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              isCorrect ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
            )}
          >
            {isCorrect ? (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span className="font-medium">All parts correct!</span>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <span className="font-medium">Some parts need work — check each part above.</span>
              </>
            )}
          </div>
        )}

        {submitted && !isMultipart && (
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
                <div className="space-y-1">
                  <span className="font-medium">
                    Not quite — keep working on this one.
                  </span>
                  {aiFeedback ? (
                    <p className="text-xs leading-relaxed opacity-90">{aiFeedback}</p>
                  ) : null}
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
