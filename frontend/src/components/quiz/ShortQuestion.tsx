import { useState, useEffect, useRef, useMemo } from "react";
import { cn, getQuestionTypeLabel, isAnswerCorrect } from "@/lib/utils";
import type { ShortQuestion as ShortQuestionType } from "@/lib/subjects";
import {
  buildFallbackHandwritingMark,
  enrichHandwritingMarkResult,
  partMarkAt,
  resolveAiMarking,
  qualifiesForOpenAiHandwriting,
} from "@/lib/questionAiMarking";
import {
  collectFullQuestionStimulus,
  displayMarks,
  formatSinglePartLabel,
  formatPartDescriptor,
  gradeMultipartAnswers,
  hasVisibleStimulus,
  marksEarnedFromPartResults,
  multipartAllCorrect,
  normalizePartKey,
  partSubmitLabel,
  resolvePartMarks,
  resolveMultipartPartDisplay,
  multipartSharedStem,
  stripQuestionHeadingFromPassage,
  stripQuestionNumberPrefix,
  type AnswerScoreDetail,
} from "@/lib/questionDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { DiagramLabelInputs } from "@/components/quiz/DiagramLabelInputs";
import { HorizontalInputFields } from "@/components/quiz/HorizontalInputFields";
import { QuizAnswerField } from "@/components/quiz/QuizAnswerField";
import {
  ExamPaperPartPrompt,
  ExamPaperQuestionHeading,
  ExamPaperStem,
} from "@/components/quiz/ExamPaperQuestionChrome";
import { isExamPaperLayoutSubject } from "@/lib/examPaperLayout";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { hasAnswerContent, handwritingAllowedForSubject, isHandwritingValue, usesHandwritingMarking } from "@/lib/handwritingMode";
import { isDiagramLabelQuestion, partHasOverlay, partUsesFigureLabels, partUsesInlineInputs, inlineInputsForPart, slotIndexForPartOverlay, slotsForPart, expectedAnswersForQuestionSlots, type DiagramLabelPart, type PartFigureLabelSource } from "@/lib/diagramLabels";
import { flushAllHandwriting, flushHandwriting } from "@/lib/handwritingFlush";
import { CheckCircle2, XCircle, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AiMarkingFeedbackPanel,
  AiMarkingPartFeedback,
} from "@/components/quiz/AiMarkingFeedbackPanel";
import { MultipartMarkBreakdown } from "@/components/quiz/MultipartMarkBreakdown";
import { WrongAnswerFeedbackPanel } from "@/components/quiz/WrongAnswerFeedbackPanel";
import { buildWrongAnswerBullets } from "@/lib/wrongAnswerFeedback";
import type { SmartMarkResult } from "@/lib/questionAiMarking";
import {
  DEMO_MATHS_DEV_PLACEHOLDER_DRAWING,
  getDemoMathsDevMockMark,
} from "@/lib/demoMathsMockFeedback";
import {
  emptyStepAnswers,
  resolveMarkBreakdown,
  type MarkStepResult,
} from "@/lib/markBreakdown";
import {
  MarkBreakdownFeedbackPanel,
  MarkBreakdownInputs,
} from "@/components/quiz/MarkBreakdownFields";

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
  /** Demo sandbox — unlimited resubmits with smart marking still enabled. */
  repeatSandbox?: boolean;
  /** Localhost demo sandbox — preload mock wrong-answer feedback and skip OpenAI. */
  devMockMarking?: boolean;
  /** VCAA mark-scheme mode — one working line per mark. */
  breakdownMode?: boolean;
  questionDisplayNumber?: number;
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

function slotBreakdownLabels(
  partLabels: string[],
  partDescriptors: string[],
  configuredParts: PartFigureLabelSource[],
): string[] {
  const labels: string[] = [];
  partLabels.forEach((label, idx) => {
    const part = configuredParts[idx];
    const inline = inlineInputsForPart(part);
    const descriptor = partDescriptors[idx]?.trim() || label;
    if (inline.length) {
      for (const box of inline) {
        labels.push(box.label?.trim() ? `${descriptor} (${box.label})` : descriptor);
      }
      return;
    }
    if (partUsesFigureLabels(part)) {
      for (const overlay of part?.labelOverlays ?? []) {
        labels.push(
          overlay.label?.trim() ? `${descriptor} (${overlay.label})` : descriptor,
        );
      }
      return;
    }
    labels.push(descriptor);
  });
  return labels;
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
  repeatSandbox = false,
  devMockMarking = false,
  breakdownMode = false,
  questionDisplayNumber = 1,
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
  const [aiMark, setAiMark] = useState<SmartMarkResult | null>(null);
  const [stepAnswers, setStepAnswers] = useState<string[]>([]);
  const devPreloadAppliedRef = useRef(false);
  const handwritingUi = handwritingAllowedForSubject(subjectId);
  const examPaper = isExamPaperLayoutSubject(subjectId);

  const configuredParts: ShortQuestionType["answerParts"] =
    question.answerParts?.filter(
      (p) => p?.label?.trim() || partHasOverlay(p) || partUsesFigureLabels(p) || partUsesInlineInputs(p),
    ) ?? [];
  const diagramImageUrl = question.imageUrls?.[0]?.trim() ?? "";
  const isDiagramLabel = isDiagramLabelQuestion(
    configuredParts as DiagramLabelPart[],
    diagramImageUrl,
  );
  const configuredDisplay =
    !isDiagramLabel && configuredParts.length >= 1
      ? resolveMultipartPartDisplay(configuredParts, {
          stemHint: question.question,
        })
      : null;
  const partLabels = configuredDisplay
    ? configuredDisplay.letters
    : isDiagramLabel
      ? configuredParts.map((_, i) => String(i + 1))
      : detectMultipartLabels(question.question);
  const isMultipart =
    isDiagramLabel ||
    configuredParts.length >= 1 ||
    partLabels.length >= 2;
  const answerSlotCount = configuredParts.reduce((sum, part) => sum + slotsForPart(part), 0);
  const baseMarks = displayMarks(question.marks, question.type);
  const resolvedPartMarks = resolvePartMarks(configuredParts, partLabels.length, baseMarks);
  const partMarks = isMultipart
    ? isDiagramLabel
      ? configuredParts.map((p) => p.marks ?? 1)
      : configuredParts.map((part, idx) => {
          const inline = inlineInputsForPart(part);
          if (inline.length) {
            return inline.reduce((sum, box) => sum + (box.marks ?? 1), 0);
          }
          if (partUsesFigureLabels(part)) {
            return (part.labelOverlays ?? []).reduce((sum, overlay) => sum + (overlay.marks ?? 1), 0);
          }
          return resolvedPartMarks[idx] ?? 1;
        })
    : [];
  const slotMarks = isMultipart
    ? configuredParts.flatMap((part, idx) => {
        const inline = inlineInputsForPart(part);
        if (inline.length) return inline.map((box) => box.marks ?? 1);
        if (partUsesFigureLabels(part)) {
          return (part.labelOverlays ?? []).map((overlay) => overlay.marks ?? 1);
        }
        return [part.marks ?? resolvedPartMarks[idx] ?? 1];
      })
    : [];
  const effectiveTotalMarks = isMultipart
    ? partMarks.reduce((sum, m) => sum + m, 0)
    : baseMarks;
  const markBreakdown = useMemo(
    () => resolveMarkBreakdown({ ...question, marks: effectiveTotalMarks }),
    [question, effectiveTotalMarks],
  );
  const breakdownActive = breakdownMode && !isMultipart;
  const hasExplicitPartMarks =
    isMultipart &&
    configuredParts.length >= 1 &&
    configuredParts.every((p) => typeof p.marks === "number" && (p.marks ?? 0) > 0);
  const partDescriptors = configuredDisplay
    ? configuredDisplay.descriptors
    : detectMultipartDescriptors(question.question, partLabels);
  const partPlaceholders =
    configuredParts.length >= 1
      ? configuredParts.map((p) => p.placeholder?.trim() || "")
      : [];
  const partImageUrls =
    configuredParts.length >= 1
      ? configuredParts.map((p) => p.imageUrl?.trim() || "")
      : [];
  const expectedAnswersForDisplay = isMultipart
    ? expectedAnswersForQuestionSlots(
        configuredParts,
        (question.acceptedAnswers ?? []).map(formatExpectedAnswer),
      )
    : (question.acceptedAnswers ?? []).map(formatExpectedAnswer);

  const useSmartMarking = resolveAiMarking({
    useAiMarking: question.useAiMarking,
    questionText: question.question,
    partLabels: partDescriptors,
    acceptedAnswers: question.acceptedAnswers,
    questionType: question.type,
    subjectId,
  });

  const openAiHandwritingEligible = qualifiesForOpenAiHandwriting({
    questionText: question.question,
    partLabels: partDescriptors,
    acceptedAnswers: question.acceptedAnswers,
  });

  const usesHandwritingAi = usesHandwritingMarking(
    subjectId,
    answer,
    parts,
    isMultipart,
    openAiHandwritingEligible,
  );

  const useTextArea = useSmartMarking && !isMultipart;

  const displayStem =
    isMultipart && configuredParts.length >= 2
      ? multipartSharedStem(question)
      : stripQuestionNumberPrefix(question.question);

  useEffect(() => {
    if (!isMultipart) return;
    setParts((prev) => {
      const need = answerSlotCount || partLabels.length;
      if (prev.length === need) return prev;
      return Array.from({ length: need }, (_, i) => prev[i] ?? "");
    });
  }, [isMultipart, answerSlotCount, partLabels.length]);

  useEffect(() => {
    if (!breakdownActive) return;
    setStepAnswers((prev) => {
      const need = markBreakdown.steps.length;
      if (prev.length === need) return prev;
      return emptyStepAnswers(need);
    });
  }, [breakdownActive, markBreakdown.steps.length]);

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
      setParts(Array(answerSlotCount || partLabels.length).fill(""));
      setPartResults(Array(answerSlotCount || partLabels.length).fill(true));
    }
  }, [lockedCorrect, question, partLabels.length]);

  useEffect(() => {
    if (!devMockMarking || devPreloadAppliedRef.current || persistedState?.submitted) return;
    const mock = getDemoMathsDevMockMark(expectedAnswersForDisplay);
    if (!mock) return;
    const slotCount = isMultipart ? answerSlotCount || partLabels.length : 1;
    devPreloadAppliedRef.current = true;
    const mockParts = Array.from({ length: slotCount }, () => DEMO_MATHS_DEV_PLACEHOLDER_DRAWING);
    setParts(mockParts);
    const partCorrectFlags = mockParts.map((_, idx) => {
      const hit = mock.partResults?.find((p) => p.index === idx);
      return hit ? hit.correct : false;
    });
    setPartResults(partCorrectFlags);
    setAiMark(mock);
    setSubmitted(true);
    setIsCorrect(false);
  }, [
    devMockMarking,
    persistedState?.submitted,
    isMultipart,
    answerSlotCount,
    partLabels.length,
    expectedAnswersForDisplay,
  ]);

  const compositeAnswer =
    isMultipart
      ? partLabels.map((label, idx) => `${partSubmitLabel(label)} ${parts[idx] ?? ""}`.trim()).join("; ")
      : answer;

  const handwritingFlushKey = (slot: string) =>
    questionKey ? `${questionKey}:${slot}` : "";

  const resolveHandwritingState = () => {
    flushAllHandwriting();
    if (breakdownActive) {
      const resolvedSteps = stepAnswers.map((step, idx) => {
        const key = handwritingFlushKey(`step-${idx}`);
        return key ? flushHandwriting(key) || step : step;
      });
      return { answer, parts, stepAnswers: resolvedSteps };
    }
    if (isMultipart) {
      const resolvedParts = parts.map((part, idx) => {
        const key = handwritingFlushKey(`part-${idx}`);
        return key ? flushHandwriting(key) || part : part;
      });
      return {
        answer: resolvedParts
          .map((part, idx) => `${partSubmitLabel(partLabels[idx] ?? "")} ${part}`.trim())
          .join("; "),
        parts: resolvedParts,
        stepAnswers,
      };
    }
    const key = handwritingFlushKey("main");
    const resolvedAnswer = key ? flushHandwriting(key) || answer : answer;
    return { answer: resolvedAnswer, parts, stepAnswers };
  };

  const canSubmit =
    (breakdownActive
      ? stepAnswers.every((p) => hasAnswerContent(p))
      : isMultipart
        ? parts.every((p) => hasAnswerContent(p))
        : hasAnswerContent(compositeAnswer)) &&
    !disabled &&
    !aiMarking &&
    (!submitted || (allowRetry && !isCorrect) || repeatSandbox);

  const handleSubmit = async () => {
    if (!canSubmit) return;

    const { answer: resolvedAnswer, parts: resolvedParts, stepAnswers: resolvedSteps } =
      resolveHandwritingState();
    if (isMultipart) setParts(resolvedParts);
    else if (breakdownActive) setStepAnswers(resolvedSteps);
    else setAnswer(resolvedAnswer);
    const resolvedComposite = isMultipart
      ? partLabels
          .map((label, idx) => `${partSubmitLabel(label)} ${resolvedParts[idx] ?? ""}`.trim())
          .join("; ")
      : resolvedAnswer;

    const accepted = question.acceptedAnswers ?? [];
    const usesHandwritingAi = usesHandwritingMarking(
      subjectId,
      resolvedAnswer,
      resolvedParts,
      isMultipart,
      openAiHandwritingEligible,
    );
    if (usesHandwritingAi || breakdownActive) {
      toast.error(
        breakdownActive
          ? "Mark breakdown uses AI marking — only available on long-answer questions."
          : "Short-answer questions use keyword matching. Type your answer instead of drawing.",
      );
    }

    let correct = false;
    let nextDpHint: number | null = null;
    let partCorrectFlags: boolean[] = [];

    if (isMultipart) {
      const gradedParts = gradeMultipartAnswers(resolvedParts, accepted, configuredParts);
      partCorrectFlags = gradedParts.map((g) => g.correct);
      setPartResults(partCorrectFlags);
      correct = multipartAllCorrect(partCorrectFlags);
      nextDpHint = Math.max(...gradedParts.map((g) => g.dpHint ?? 0)) || null;
    } else if (!breakdownActive) {
      setPartResults([]);
      const graded = isAnswerCorrect(resolvedComposite, accepted);
      correct = graded.correct;
      nextDpHint = graded.dpHint;
    }
    setDpHint(nextDpHint);

    let finalCorrect = correct;
    setAiMark(null);

    if (isMultipart) {
      const slotCount = answerSlotCount || partLabels.length;
      if (partCorrectFlags.length !== slotCount) {
        const graded = gradeMultipartAnswers(parts, accepted, configuredParts);
        partCorrectFlags = graded.map((g) => g.correct);
      }
      finalCorrect = multipartAllCorrect(partCorrectFlags);
      setPartResults(partCorrectFlags);
    }

    setIsCorrect(finalCorrect);
    setSubmitted(true);
    if (repeatSandbox && !finalCorrect) {
      setAiMark((prev) =>
        enrichHandwritingMarkResult(
          prev ?? buildFallbackHandwritingMark(expectedAnswersForDisplay),
          expectedAnswersForDisplay,
        ),
      );
    }
    const earned = isMultipart
      ? marksEarnedFromPartResults(partCorrectFlags, slotMarks.length ? slotMarks : partMarks)
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
    <div className={cn("space-y-5", examPaper && "vce-question-paper")}>
      {/* Question header */}
      {!examPaper ? (
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
      ) : (
        <ExamPaperQuestionHeading
          questionNumber={questionDisplayNumber}
          marks={effectiveTotalMarks}
        />
      )}

      {!hidePassage && (() => {
        const stimulus = collectFullQuestionStimulus(question);
        if (hasVisibleStimulus(stimulus)) {
          return (
            <PassageBlock
              passage={stripQuestionHeadingFromPassage(stimulus.passage)}
              imageUrls={stimulus.imageUrls}
            />
          );
        }
        if (question.imageUrls?.length && !isDiagramLabel) {
          return (
            <QuestionImageGrid urls={question.imageUrls} title="" />
          );
        }
        return null;
      })()}

      {!examPaper && (!isMultipart || !hasExplicitPartMarks) ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {effectiveTotalMarks}{" "}
          {effectiveTotalMarks === 1 ? "mark" : "marks"}
        </p>
      ) : null}
      {displayStem.trim() ? (
      examPaper ? (
        <ExamPaperStem text={displayStem} />
      ) : (
      <div
        className={cn(
          "font-display leading-relaxed text-foreground",
          isMultipart
            ? "text-[1.35rem] font-semibold sm:text-[1.65rem]"
            : "text-[1.18rem] sm:text-[1.45rem]",
        )}
      >
        <RichQuestionContent
          text={displayStem}
          className={cn(
            "prose max-w-none prose-p:my-0",
            isMultipart ? "prose-lg prose-p:font-semibold" : "prose-base",
          )}
        />
      </div>
      )
      ) : null}

      {/* Answer input */}
      <div className="space-y-3">
        {isDiagramLabel && diagramImageUrl ? (
          <>
          <DiagramLabelInputs
            imageUrl={diagramImageUrl}
            parts={configuredParts as DiagramLabelPart[]}
            values={parts}
            subjectId={subjectId}
            examPaperMode={examPaper}
            onChange={(idx, value) =>
              setParts((prev) => {
                const next = [...prev];
                next[idx] = value;
                return next;
              })
            }
            disabled={disabled || (submitted && !allowRetry && !repeatSandbox)}
            submitted={submitted}
            partResults={partResults}
          />
          {submitted && !isCorrect ? (
            <div className="space-y-1">
              {(configuredParts as DiagramLabelPart[]).map((overlay, idx) => {
                if (partResults[idx] !== false || !expectedAnswersForDisplay[idx]?.trim()) {
                  return null;
                }
                return (
                  <p key={`${overlay.key}-${idx}-expected`} className="text-[11px] text-muted-foreground">
                    Label {overlay.label ?? idx + 1}: correct answer{" "}
                    <span className="text-[13px] font-semibold text-foreground">
                      {expectedAnswersForDisplay[idx]}
                    </span>
                  </p>
                );
              })}
            </div>
          ) : null}
          </>
        ) : isMultipart ? (
            <div className={cn("flex flex-col gap-4", !examPaper && "border-t border-black/8 pt-4")}>
              {partLabels.map((label, idx) => (
                <div key={`${label}-${idx}`} className="space-y-1">
                  {(() => {
                    const part = configuredParts[idx];
                    const hasInlineInputs = partUsesInlineInputs(part);
                    const hasFigureLabels = partUsesFigureLabels(part);
                    const hasMultiSlotInputs = hasInlineInputs || hasFigureLabels;
                    const slotBaseIndex = configuredParts
                      .slice(0, idx)
                      .reduce((sum, configuredPart) => sum + slotsForPart(configuredPart), 0);
                    const slotCount = slotsForPart(part);
                    const overlayResults = partResults.slice(
                      slotBaseIndex,
                      slotBaseIndex + slotCount,
                    );
                    const partFullyCorrect =
                      overlayResults.length > 0
                        ? overlayResults.every((result) => result === true)
                        : partResults[slotBaseIndex] === true;
                    const partFullyWrong =
                      overlayResults.length > 0
                        ? overlayResults.some((result) => result === false)
                        : partResults[slotBaseIndex] === false;
                    return (
                      <>
                  <div className="flex items-center justify-between gap-2">
                    {examPaper ? (
                      <ExamPaperPartPrompt
                        text={partDescriptors[idx] ?? ""}
                        className="min-w-0 flex-1"
                      />
                    ) : (
                    <div className="min-w-0 flex-1 font-display text-[0.98rem] font-normal leading-relaxed text-foreground/90 sm:text-[1.06rem]">
                      <RichQuestionContent
                        text={partDescriptors[idx] ?? ""}
                        preferMarkdown
                        className="prose prose-sm max-w-none prose-p:my-0 prose-p:font-normal"
                      />
                    </div>
                    )}
                    {!examPaper ? (
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {partMarks[idx]} {partMarks[idx] === 1 ? "mark" : "marks"}
                    </span>
                    ) : null}
                  </div>
                  {partImageUrls[idx] ? (
                    hasInlineInputs ? (
                      <QuestionImageGrid urls={[partImageUrls[idx]!]} />
                    ) : hasFigureLabels ? (
                      <DiagramLabelInputs
                        imageUrl={partImageUrls[idx]!}
                        parts={(part?.labelOverlays ?? []) as DiagramLabelPart[]}
                        values={parts.slice(slotBaseIndex, slotBaseIndex + slotCount)}
                        subjectId={subjectId}
                        examPaperMode={examPaper}
                        onChange={(overlayIdx, value) => {
                          const globalIdx = slotIndexForPartOverlay(
                            configuredParts,
                            idx,
                            overlayIdx,
                          );
                          setParts((prev) => {
                            const next = [...prev];
                            next[globalIdx] = value;
                            return next;
                          });
                        }}
                        disabled={disabled || (submitted && !allowRetry && !repeatSandbox)}
                        submitted={submitted}
                        partResults={overlayResults}
                      />
                    ) : (
                      <QuestionImageGrid urls={[partImageUrls[idx]!]} />
                    )
                  ) : null}
                  {hasInlineInputs ? (
                    <HorizontalInputFields
                      boxes={inlineInputsForPart(part)}
                      values={parts.slice(slotBaseIndex, slotBaseIndex + slotCount)}
                      subjectId={subjectId}
                      examPaperMode={examPaper}
                      onChange={(boxIdx, value) => {
                        const globalIdx = slotIndexForPartOverlay(configuredParts, idx, boxIdx);
                        setParts((prev) => {
                          const next = [...prev];
                          next[globalIdx] = value;
                          return next;
                        });
                      }}
                      disabled={disabled || (submitted && !allowRetry && !repeatSandbox)}
                      submitted={submitted}
                      partResults={overlayResults}
                    />
                  ) : null}
                  {submitted && !hasMultiSlotInputs ? (
                    <p
                      className={cn(
                        "text-[11px] font-semibold",
                        partResults[slotBaseIndex] === true ? "text-success" : "text-danger",
                      )}
                    >
                      {partResults[slotBaseIndex] === true ? "Correct" : "Incorrect"}
                    </p>
                  ) : null}
                  {submitted && hasMultiSlotInputs ? (
                    <p
                      className={cn(
                        "text-[11px] font-semibold",
                        partFullyCorrect ? "text-success" : partFullyWrong ? "text-danger" : "text-muted-foreground",
                      )}
                    >
                      {partFullyCorrect
                        ? "Correct"
                        : partFullyWrong
                          ? hasInlineInputs
                            ? "Some answers incorrect"
                            : "Some labels incorrect"
                          : "Marked"}
                    </p>
                  ) : null}
                  {submitted && hasMultiSlotInputs
                    ? inlineInputsForPart(part).map((box, boxIdx) => {
                        const globalIdx = slotIndexForPartOverlay(
                          configuredParts,
                          idx,
                          boxIdx,
                        );
                        if (
                          partResults[globalIdx] !== false ||
                          !expectedAnswersForDisplay[globalIdx]?.trim()
                        ) {
                          return null;
                        }
                        return (
                          <p
                            key={`${box.key}-${boxIdx}-expected`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Box {box.label ?? boxIdx + 1}: correct answer{" "}
                            <span className="text-[13px] font-semibold text-foreground">
                              {expectedAnswersForDisplay[globalIdx]}
                            </span>
                          </p>
                        );
                      })
                    : null}
                  {submitted && hasFigureLabels && !hasInlineInputs
                    ? (part?.labelOverlays ?? []).map((overlay, overlayIdx) => {
                        const globalIdx = slotIndexForPartOverlay(
                          configuredParts,
                          idx,
                          overlayIdx,
                        );
                        if (
                          partResults[globalIdx] !== false ||
                          !expectedAnswersForDisplay[globalIdx]?.trim()
                        ) {
                          return null;
                        }
                        return (
                          <p
                            key={`${overlay.key}-${overlayIdx}-expected`}
                            className="text-[11px] text-muted-foreground"
                          >
                            Label {overlay.label ?? overlayIdx + 1}: correct answer{" "}
                            <span className="text-[13px] font-semibold text-foreground">
                              {expectedAnswersForDisplay[globalIdx]}
                            </span>
                          </p>
                        );
                      })
                    : null}
                  {!hasMultiSlotInputs ? (
                  <div className={cn("flex items-stretch", examPaper && "w-full")}>
                    <QuizAnswerField
                      value={parts[slotBaseIndex] ?? ""}
                      onChange={(next) =>
                        setParts((prev) => {
                          const updated = [...prev];
                          updated[slotBaseIndex] = next;
                          return updated;
                        })
                      }
                      placeholder={partPlaceholders[idx] || "Write your answer…"}
                      disabled={disabled || (submitted && !allowRetry && !repeatSandbox)}
                      subjectId={subjectId}
                      examPaperMode={examPaper}
                      multiline={resolveAiMarking({
                        useAiMarking: question.useAiMarking,
                        questionText: partDescriptors[idx] ?? "",
                        acceptedAnswers: [expectedAnswersForDisplay[slotBaseIndex] ?? ""],
                        questionType: "short",
                        subjectId,
                      })}
                      rows={handwritingUi ? 4 : 3}
                      handwritingSize="md"
                      flushKey={handwritingFlushKey(`part-${slotBaseIndex}`)}
                      onKeyDown={handleKeyDown}
                      className={cn(
                        examPaper && "w-full min-w-0",
                        submitted && partResults[slotBaseIndex] === true && "border-success/60 bg-success/5",
                        submitted && partResults[slotBaseIndex] === false && "border-danger/60 bg-danger/5",
                      )}
                    />
                  </div>
                  ) : null}
                  {submitted && isHandwritingValue(parts[slotBaseIndex] ?? "") && aiMark && !hasMultiSlotInputs ? (
                    <AiMarkingPartFeedback
                      partResult={partMarkAt(aiMark, idx)}
                    />
                  ) : submitted &&
                    !hasMultiSlotInputs &&
                    partResults[slotBaseIndex] === false &&
                    expectedAnswersForDisplay[slotBaseIndex] &&
                    !isHandwritingValue(parts[slotBaseIndex] ?? "") ? (
                    <WrongAnswerFeedbackPanel
                      title="Feedback"
                      bullets={buildWrongAnswerBullets({
                        studentAnswer: parts[slotBaseIndex] ?? "",
                        expectedAnswers: [expectedAnswersForDisplay[slotBaseIndex] ?? ""].filter(Boolean),
                        guidance: question.guidance,
                        questionText: question.question,
                      })}
                    />
                  ) : null}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          ) : breakdownActive ? (
            <div className="space-y-3">
              <MarkBreakdownInputs
                breakdown={markBreakdown}
                values={stepAnswers}
                onChange={(idx, value) =>
                  setStepAnswers((prev) => {
                    const next = [...prev];
                    next[idx] = value;
                    return next;
                  })
                }
                disabled={disabled || (submitted && !allowRetry && !repeatSandbox)}
                submitted={submitted}
                stepResults={aiMark?.stepResults?.map((s) => s.awarded)}
                subjectId={subjectId}
                examPaperMode={examPaper}
                flushKeyPrefix={questionKey}
              />
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
                {aiMarking ? "Marking…" : submitted ? "Submitted" : "Submit mark breakdown"}
              </Button>
            </div>
          ) : (
            <div className="space-y-1">
              {(() => {
                const singlePartLabel =
                  configuredParts.length === 1
                    ? formatSinglePartLabel(configuredParts[0]!.label)
                    : "";
                return singlePartLabel ? (
                  examPaper ? (
                    <ExamPaperPartPrompt text={singlePartLabel} />
                  ) : (
                  <div className="font-display text-[1.05rem] leading-relaxed text-foreground sm:text-[1.2rem]">
                    <RichQuestionContent
                      text={singlePartLabel}
                      className="prose prose-base max-w-none prose-p:my-0"
                    />
                  </div>
                  )
                ) : null;
              })()}
              <div
                className={cn(
                  "flex gap-2",
                  examPaper || useTextArea || handwritingUi ? "flex-col" : "items-stretch",
                )}
              >
                <div
                  className={cn(
                    "flex items-stretch",
                    (examPaper || useTextArea || handwritingUi) && "w-full",
                  )}
                >
                  <QuizAnswerField
                    value={answer}
                    onChange={setAnswer}
                    placeholder="Write your answer…"
                    disabled={disabled || (submitted && !allowRetry && !repeatSandbox)}
                    subjectId={subjectId}
                    examPaperMode={examPaper}
                    multiline={useTextArea}
                    rows={handwritingUi ? 8 : useTextArea ? 5 : 1}
                    handwritingSize={useTextArea ? "lg" : "md"}
                    flushKey={handwritingFlushKey("main")}
                    onKeyDown={handleKeyDown}
                    className={cn(
                      examPaper && "w-full min-w-0",
                      useTextArea && "leading-relaxed",
                      submitted && isCorrect && "border-success/60 bg-success/5",
                      submitted && !isCorrect && "border-danger/60 bg-danger/5",
                    )}
                  />
                </div>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit}
                  className={cn(
                    "shrink-0 gap-2 btn-accent",
                    (examPaper || useTextArea || handwritingUi) && "w-full sm:w-auto",
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
              {submitted && !isCorrect ? (
                <WrongAnswerFeedbackPanel
                  title="Feedback"
                  bullets={buildWrongAnswerBullets({
                    studentAnswer: answer,
                    expectedAnswers: expectedAnswersForDisplay.filter(Boolean),
                    guidance: question.guidance,
                    questionText: question.question,
                  })}
                />
              ) : null}
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
                ? multipartAllCorrect(partResults)
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
              multipartAllCorrect(partResults)
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            )}
          >
            {multipartAllCorrect(partResults) ? (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span className="font-medium">All parts correct!</span>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <span className="font-medium">Some parts need work — see the mark breakdown below.</span>
              </>
            )}
          </div>
        )}

        {submitted && isMultipart ? (
          <MultipartMarkBreakdown
            partLabels={slotBreakdownLabels(partLabels, partDescriptors, configuredParts)}
            partResults={partResults}
            partMarks={slotMarks.length ? slotMarks : partMarks}
            expectedAnswers={expectedAnswersForDisplay}
            studentAnswers={parts.map((part, idx) => {
              const read = partMarkAt(aiMark, idx)?.studentAnswerRead?.trim();
              if (read) return read;
              return isHandwritingValue(part) ? "" : part;
            })}
            guidance={usesHandwritingAi && aiMark ? undefined : question.guidance}
          />
        ) : null}

        {submitted && breakdownActive && aiMark?.stepResults?.length ? (
          <MarkBreakdownFeedbackPanel stepResults={aiMark.stepResults as MarkStepResult[]} />
        ) : null}

        {submitted && !isMultipart && !isCorrect && !aiMark && !breakdownActive ? (
          <WrongAnswerFeedbackPanel
            bullets={buildWrongAnswerBullets({
              studentAnswer: compositeAnswer,
              expectedAnswers: expectedAnswersForDisplay,
              guidance: question.guidance,
              questionText: question.question,
            })}
          />
        ) : null}

        {submitted && !isMultipart && isCorrect && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              "bg-success/10 text-success",
            )}
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <div>
              <span className="font-medium">Correct! Well done.</span>
            </div>
          </div>
        )}
        {aiMark && submitted && !(isMultipart && usesHandwritingAi) ? (
          <AiMarkingFeedbackPanel
            feedback={aiMark.feedback}
            correct={aiMark.correct}
            correctAnswers={aiMark.correctAnswers}
            partResults={aiMark.partResults}
            partLabels={partDescriptors}
          />
        ) : null}
      </div>
    </div>
  );
}
