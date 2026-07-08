import { useEffect, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn, getQuestionTypeLabel, isAnswerCorrect } from "@/lib/utils";
import type { LongQuestion as LongQuestionType } from "@/lib/subjects";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { HorizontalInputFields } from "@/components/quiz/HorizontalInputFields";
import { QuizAnswerField } from "@/components/quiz/QuizAnswerField";
import {
  collectHandwritingImages,
  hasAnswerContent,
  handwritingAllowedForSubject,
  handwritingResponseSummary,
  isHandwritingValue,
  usesHandwritingMarking,
} from "@/lib/handwritingMode";
import {
  partHasOverlay,
  partUsesFigureLabels,
  partUsesInlineInputs,
  inlineInputsForPart,
  slotsForPart,
  slotIndexForPartOverlay,
  expectedAnswersForQuestionSlots,
  type PartFigureLabelSource,
} from "@/lib/diagramLabels";
import { writtenApiPath } from "@/lib/writtenAnswerUpload";
import {
  buildSmartMarkPayload,
  buildFallbackHandwritingMark,
  enrichHandwritingMarkResult,
  enrichSmartMarkResult,
  partMarkAt,
  requestHandwritingMark,
  requestSmartMark,
  resolveAiMarking,
  qualifiesForOpenAiHandwriting,
  type SmartMarkResult,
} from "@/lib/questionAiMarking";
import { handwritingMarkUserError } from "@/lib/userFacingErrors";
import {
  collectFullQuestionStimulus,
  displayMarks,
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
import { MultipartMarkBreakdown } from "@/components/quiz/MultipartMarkBreakdown";
import { WrongAnswerFeedbackPanel } from "@/components/quiz/WrongAnswerFeedbackPanel";
import { buildWrongAnswerBullets } from "@/lib/wrongAnswerFeedback";
import { toast } from "sonner";
import { isPremiumError, isPremiumUser, PREMIUM_PATH } from "@/lib/premium";
import { AiMarkingFeedbackPanel, AiMarkingPartFeedback } from "@/components/quiz/AiMarkingFeedbackPanel";
import { PremiumGate } from "@/components/premium/GetPremiumButton";
import {
  ExamPaperPartPrompt,
  ExamPaperQuestionHeading,
  ExamPaperStem,
} from "@/components/quiz/ExamPaperQuestionChrome";
import { isExamPaperLayoutSubject } from "@/lib/examPaperLayout";
import {
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface LongQuestionProps {
  question: LongQuestionType;
  subjectId: string;
  questionKey: string;
  onAnswer: (correct: boolean | null, detail?: AnswerScoreDetail) => void;
  disabled?: boolean;
  hidePassage?: boolean;
  lockedCorrect?: boolean;
  classFullyCorrectPercent?: number | null;
  submitLabel?: string;
  /** Practice-only mode (no API save). Used for wrong-answer review. */
  practiceOnly?: boolean;
  /** Demo sandbox — unlimited resubmits with smart marking still enabled. */
  repeatSandbox?: boolean;
  /** VCE exam booklet layout (demo preview). */
  examPaperLayout?: boolean;
  questionDisplayNumber?: number;
  persistedState?: {
    response?: string;
    parts?: string[];
    submitted?: boolean;
    saved?: boolean;
    autoMarkResult?: boolean | null;
    dpHint?: number | null;
    partResults?: (boolean | null)[];
  };
  onStateChange?: (state: {
    response: string;
    parts: string[];
    submitted: boolean;
    saved: boolean;
    autoMarkResult: boolean | null;
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

export function LongQuestion({
  question,
  subjectId,
  questionKey,
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
  submitLabel = "Submit Answer",
  practiceOnly = false,
  repeatSandbox = false,
  examPaperLayout: examPaperLayoutProp,
  questionDisplayNumber = 1,
  persistedState,
  onStateChange,
}: LongQuestionProps) {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const navigate = useNavigate();
  const configuredParts: LongQuestionType["answerParts"] =
    question.answerParts?.filter(
      (p) =>
        p?.label?.trim() ||
        partHasOverlay(p) ||
        partUsesFigureLabels(p) ||
        partUsesInlineInputs(p),
    ) ?? [];
  const configuredDisplay =
    configuredParts.length >= 1
      ? resolveMultipartPartDisplay(configuredParts, {
          stemHint: question.question,
        })
      : null;
  const partLabels = configuredDisplay
    ? configuredDisplay.letters
    : detectMultipartLabels(question.question);
  const isMultipart = configuredParts.length >= 1 || partLabels.length >= 2;
  const partDescriptors = configuredDisplay
    ? configuredDisplay.descriptors
    : detectMultipartDescriptors(question.question, partLabels);
  const openAiHandwritingEligible = qualifiesForOpenAiHandwriting({
    questionText: question.question,
    partLabels: partDescriptors,
    acceptedAnswers: question.acceptedAnswers,
  });

  const partPlaceholders =
    configuredParts.length >= 1
      ? configuredParts.map((p) => p.placeholder?.trim() || "")
      : [];
  const partImageUrls =
    configuredParts.length >= 1
      ? configuredParts.map((p) => p.imageUrl?.trim() || "")
      : [];
  const baseMarks = displayMarks(question.marks, question.type);
  const partMarks = isMultipart
    ? resolvePartMarks(configuredParts, partLabels.length, baseMarks)
    : [];
  const effectiveTotalMarks = isMultipart
    ? partMarks.reduce((sum, m) => sum + m, 0)
    : baseMarks;
  const hasExplicitPartMarks =
    isMultipart &&
    configuredParts.length >= 1 &&
    configuredParts.every((p) => typeof p.marks === "number" && (p.marks ?? 0) > 0);
  const expectedAnswersForDisplay = isMultipart
    ? expectedAnswersForQuestionSlots(
        configuredParts,
        [
          ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : []),
          ...(question.answer ? [question.answer] : []),
        ]
          .map((s) => formatExpectedAnswer(s).trim())
          .filter(Boolean),
      )
    : [
        ...(
          Array.isArray(question.acceptedAnswers)
            ? question.acceptedAnswers.map((x) => formatExpectedAnswer(x))
            : question.answer
              ? [formatExpectedAnswer(question.answer)]
              : []
        ),
      ];
  const displayStem =
    isMultipart && configuredParts.length >= 2
      ? multipartSharedStem(question)
      : stripQuestionNumberPrefix(question.question);
  const [response, setResponse] = useState(persistedState?.response ?? "");
  const [parts, setParts] = useState<string[]>(persistedState?.parts ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(persistedState?.saved));
  const [submitted, setSubmitted] = useState(Boolean(persistedState?.submitted));
  const [autoMarkResult, setAutoMarkResult] = useState<boolean | null>(persistedState?.autoMarkResult ?? null);
  const [dpHint, setDpHint] = useState<number | null>(persistedState?.dpHint ?? null);
  const [partResults, setPartResults] = useState<(boolean | null)[]>(persistedState?.partResults ?? []);
  const [yourPeerRating, setYourPeerRating] = useState<{
    average: number | null;
    count: number;
  }>({ average: null, count: 0 });
  const [aiMark, setAiMark] = useState<SmartMarkResult | null>(null);
  const [aiMarking, setAiMarking] = useState(false);
  const [premiumLockedMessage, setPremiumLockedMessage] = useState<string | null>(null);
  const handwritingUi = handwritingAllowedForSubject(subjectId);
  const examPaper = examPaperLayoutProp ?? isExamPaperLayoutSubject(subjectId);

  const usesHandwritingAi = usesHandwritingMarking(
    subjectId,
    response,
    parts,
    isMultipart,
    openAiHandwritingEligible,
  );

  useEffect(() => {
    onStateChange?.({
      response,
      parts,
      submitted,
      saved,
      autoMarkResult,
      dpHint,
      partResults,
    });
  }, [response, parts, submitted, saved, autoMarkResult, dpHint, partResults]);

  useEffect(() => {
    if (practiceOnly) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiFetch<{
          response: { text: string } | null;
          yourPeerRating?: { average: number | null; count: number };
          aiMark?: { correct: boolean; scorePercent: number | null; feedback: string };
        }>(writtenApiPath(subjectId, questionKey));
        if (cancelled) return;
        if (data?.yourPeerRating) {
          setYourPeerRating({
            average: data.yourPeerRating.average ?? null,
            count: data.yourPeerRating.count ?? 0,
          });
        }
        if (data?.aiMark?.feedback) {
          setAiMark({
            correct: Boolean(data.aiMark.correct),
            scorePercent: Number(data.aiMark.scorePercent ?? 0),
            feedback: data.aiMark.feedback,
          });
        }
        if (data?.response) {
          const t = data.response.text?.trim();
          if (t) {
            if (isMultipart) {
              const parsed = Array(partLabels.length).fill("");
              for (let i = 0; i < partLabels.length; i += 1) {
                const label = partLabels[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const nextLabels = partLabels
                  .slice(i + 1)
                  .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
                const boundary = nextLabels.length ? `(?=\\n\\s*(?:${nextLabels.join("|")})\\))` : "(?=$)";
                const re = new RegExp(`(?:^|\\n)\\s*${label}\\)\\s*([\\s\\S]*?)${boundary}`, "i");
                const m = t.match(re);
                if (m?.[1]) parsed[i] = m[1].trim();
              }
              setParts((prev) => prev.map((p, idx) => (p.trim() ? p : parsed[idx] || "")));
            }
            setResponse((prev) => (prev.trim() ? prev : t));
          }
          if (t) {
            setSaved(true);
          }
        }
      } catch {
        // ignore
      }
    };
    void load();
    const onFocus = () => void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [subjectId, questionKey, isMultipart, partLabels, practiceOnly]);

  const handleSave = async () => {
    if (!premium) {
      setPremiumLockedMessage("Long-answer questions require Premium.");
      toast.error("Long-answer questions require Premium.");
      return;
    }
    const usesHandwritingAi = usesHandwritingMarking(
      subjectId,
      response,
      parts,
      isMultipart,
      openAiHandwritingEligible,
    );
    const handwritingImages = collectHandwritingImages(response, parts, isMultipart);
    const hasContent = isMultipart
      ? parts.every((part) => hasAnswerContent(part))
      : hasAnswerContent(response);
    const effectiveResponse = isMultipart
      ? partLabels.map((label, idx) => `${partSubmitLabel(label)} ${parts[idx] ?? ""}`.trim()).join("\n")
      : response;
    const responseToStore = usesHandwritingAi
      ? handwritingResponseSummary(handwritingImages.length)
      : effectiveResponse;

    if (!hasContent || saving || disabled || (!practiceOnly && saved)) return;

    setPremiumLockedMessage(null);
    setSaving(true);
    try {
      if (!practiceOnly) {
        await apiFetch(writtenApiPath(subjectId, questionKey), {
          method: "PUT",
          body: JSON.stringify({
            responseText: responseToStore,
          }),
        });
        setSaved(true);
      }
      setSubmitted(true);
      const acceptedPool = [
        ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : []),
        ...(question.answer ? [question.answer] : []),
      ]
        .map((s) => String(s).trim())
        .filter(Boolean);
      let result: boolean | null = null;
      let partCorrectFlags: boolean[] = [];

      if (!usesHandwritingAi && effectiveResponse.trim() && acceptedPool.length > 0) {
        if (isMultipart) {
          const gradedParts = gradeMultipartAnswers(parts, acceptedPool, configuredParts);
          partCorrectFlags = gradedParts.map((g) => g.correct);
          setPartResults(partCorrectFlags);
          setDpHint(Math.max(...gradedParts.map((g) => g.dpHint ?? 0)) || null);
          result = multipartAllCorrect(partCorrectFlags);
        } else {
          setPartResults(Array(partLabels.length).fill(null));
          const graded = isAnswerCorrect(effectiveResponse, acceptedPool);
          setDpHint(graded.dpHint);
          result = graded.correct;
        }
      }
      let finalResult = result;

      const useAi = resolveAiMarking({
        useAiMarking: question.useAiMarking,
        questionText: question.question,
        partLabels: partDescriptors,
        acceptedAnswers: acceptedPool,
        questionType: question.type,
        subjectId,
      });

      const shouldAiMark =
        !usesHandwritingAi &&
        (!practiceOnly || repeatSandbox) &&
        effectiveResponse.trim() &&
        useAi &&
        result !== true;

      if (usesHandwritingAi) {
        setAiMark(null);
        setAiMarking(true);
        try {
          const ai = await requestHandwritingMark(subjectId, questionKey, {
            answer: effectiveResponse,
            parts,
            isMultipart,
            question: buildSmartMarkPayload(question, {
              marks: effectiveTotalMarks,
              partDescriptors,
              partMarks,
              expectedAnswers: expectedAnswersForDisplay,
              configuredParts,
            }),
          });
          const enriched = enrichHandwritingMarkResult(
            ai ?? buildFallbackHandwritingMark(expectedAnswersForDisplay),
            expectedAnswersForDisplay,
          );
          if (enriched.partResults?.length) {
            partCorrectFlags = parts.map((_, idx) => {
              const hit = enriched.partResults?.find((p) => p.index === idx);
              return hit ? hit.correct : (partCorrectFlags[idx] ?? false);
            });
            setPartResults(partCorrectFlags);
          }
          finalResult = isMultipart
            ? multipartAllCorrect(partCorrectFlags)
            : enriched.correct;
          setAutoMarkResult(finalResult);
          setAiMark(enriched);
        } catch (err) {
          const msg = handwritingMarkUserError(err);
          toast.error(msg);
          if (isPremiumError(err)) {
            setPremiumLockedMessage(msg);
            return;
          }
          const fallback = buildFallbackHandwritingMark(expectedAnswersForDisplay);
          finalResult = false;
          setAutoMarkResult(false);
          setAiMark(fallback);
        } finally {
          setAiMarking(false);
        }
      } else if (shouldAiMark) {
        setAiMarking(true);
        try {
          const ai = await requestSmartMark(subjectId, questionKey, {
            responseText: effectiveResponse,
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
            const enriched = enrichSmartMarkResult(ai, {
              studentAnswer: effectiveResponse,
              studentParts: isMultipart ? parts : undefined,
              expectedAnswers: expectedAnswersForDisplay,
              guidance: question.guidance,
              questionText: question.question,
            });
            setAiMark(enriched);
            if (enriched.partResults?.length) {
              partCorrectFlags = parts.map((_, idx) => {
                const hit = enriched.partResults?.find((p) => p.index === idx);
                return hit ? hit.correct : (partCorrectFlags[idx] ?? false);
              });
              setPartResults(partCorrectFlags);
            }
            finalResult = isMultipart
              ? multipartAllCorrect(partCorrectFlags)
              : enriched.correct;
            setAutoMarkResult(finalResult);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Could not mark your answer.";
          toast.error(msg);
          if (isPremiumError(err)) {
            setPremiumLockedMessage(msg);
          }
        } finally {
          setAiMarking(false);
        }
      }

      if (isMultipart) {
        const slotCount = parts.length;
        if (partCorrectFlags.length !== slotCount) {
          const graded = gradeMultipartAnswers(parts, acceptedPool, configuredParts);
          partCorrectFlags = graded.map((g) => g.correct);
        }
        finalResult = multipartAllCorrect(partCorrectFlags);
        setPartResults(partCorrectFlags);
        setAutoMarkResult(finalResult);
      }

      const earned = isMultipart
        ? marksEarnedFromPartResults(partCorrectFlags, partMarks)
        : finalResult
          ? effectiveTotalMarks
          : 0;
      if (repeatSandbox && finalResult === false) {
        setAiMark((prev) =>
          enrichHandwritingMarkResult(
            prev ?? buildFallbackHandwritingMark(expectedAnswersForDisplay),
            expectedAnswersForDisplay,
          ),
        );
      }
      setAutoMarkResult(finalResult);
      onAnswer(finalResult, { marksEarned: earned, marksTotal: effectiveTotalMarks });
      if (finalResult === true) toast.success("Answer submitted. Marked correct.");
      else if (finalResult === false) toast.error("Answer submitted. Not quite right yet.");
      else toast.success("Answer submitted.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit answer."
      );
    } finally {
      setSaving(false);
    }
  };

  const displayStudentAnswer = isMultipart
    ? partLabels
        .map((label, idx) => `${partSubmitLabel(label)} ${parts[idx] ?? ""}`.trim())
        .join("\n")
    : response;

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
        if (question.imageUrls?.length) {
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

      {yourPeerRating.count > 0 && yourPeerRating.average != null ? (
        <p className="text-sm text-muted-foreground">
          Your peer rating average:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {yourPeerRating.average.toFixed(1)}
          </span>{" "}
          / 5 ({yourPeerRating.count}{" "}
          {yourPeerRating.count === 1 ? "rating" : "ratings"})
        </p>
      ) : null}

      {lockedCorrect ? (
        <div className="flex gap-3 rounded-xl border border-success/30 bg-success/5 p-4 text-sm">
          <CheckCircle2 className="size-5 shrink-0 text-success" />
          <p className="text-success">
            <span className="font-medium">Marked correct</span> — shown for reference while you
            work on other parts.
          </p>
        </div>
      ) : (
      <Fragment>
      <div className="space-y-3">
        {isMultipart ? (
          <div className={cn("flex flex-col gap-4", !examPaper && "border-t border-black/8 pt-4")}>
            {partLabels.map((label, idx) => (
              <div key={`${label}-${idx}`} className="space-y-1">
                {(() => {
                  const part = configuredParts[idx];
                  const hasInlineInputs = partUsesInlineInputs(part);
                  const slotBaseIndex = configuredParts
                    .slice(0, idx)
                    .reduce((sum, configuredPart) => sum + slotsForPart(configuredPart), 0);
                  const slotCount = slotsForPart(part);
                  return (
                    <>
                {partImageUrls[idx] ? (
                  <QuestionImageGrid urls={[partImageUrls[idx]!]} />
                ) : null}
                <div className="flex items-start justify-between gap-2">
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
                {(practiceOnly ? submitted : saved) && !hasInlineInputs ? (
                  <p
                    className={cn(
                      "text-[11px] font-semibold",
                      partResults[idx] === true ? "text-success" : "text-danger",
                    )}
                  >
                    {partResults[idx] === true ? "Correct" : "Incorrect"}
                  </p>
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
                    disabled={disabled || (!practiceOnly && saved)}
                    submitted={submitted}
                    partResults={partResults.slice(slotBaseIndex, slotBaseIndex + slotCount)}
                  />
                ) : (
                <div className="flex items-stretch">
                  <QuizAnswerField
                    value={parts[idx] ?? ""}
                    onChange={(next) =>
                      setParts((prev) => {
                        const updated = [...prev];
                        updated[idx] = next;
                        return updated;
                      })
                    }
                    placeholder={partPlaceholders[idx] || "Write your answer…"}
                    disabled={disabled || (!practiceOnly && saved)}
                    handwritingSize={examPaper ? "lg" : "md"}
                    subjectId={subjectId}
                    examPaperMode={examPaper}
                    multiline={examPaper}
                    rows={examPaper ? 12 : undefined}
                    className={cn(saved && !examPaper && "border-success/40")}
                  />
                </div>
                )}
                {(practiceOnly ? submitted : saved) && isHandwritingValue(parts[idx] ?? "") && aiMark && !hasInlineInputs ? (
                  <AiMarkingPartFeedback
                    partResult={partMarkAt(aiMark, idx)}
                  />
                ) : submitted &&
                  !hasInlineInputs &&
                  partResults[idx] === false &&
                  expectedAnswersForDisplay[idx] &&
                  !isHandwritingValue(parts[idx] ?? "") ? (
                  <WrongAnswerFeedbackPanel
                    title="Feedback"
                    bullets={buildWrongAnswerBullets({
                      studentAnswer: parts[idx] ?? "",
                      expectedAnswers: [expectedAnswersForDisplay[idx] ?? ""].filter(Boolean),
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
        ) : (
          <div className="space-y-2">
            <QuizAnswerField
              value={response}
              onChange={setResponse}
              placeholder={
                configuredParts.length === 1 && configuredParts[0]?.placeholder
                  ? configuredParts[0].placeholder
                  : "Write your response here…"
              }
              multiline
              rows={examPaper ? 14 : handwritingUi ? 10 : 12}
              handwritingSize="lg"
              disabled={disabled || (!practiceOnly && saved)}
              subjectId={subjectId}
              examPaperMode={examPaper}
              className={cn("w-full min-w-0 resize-y", saved && !examPaper && "border-success/40")}
            />
            {submitted && autoMarkResult === false ? (
              <WrongAnswerFeedbackPanel
                title="Feedback"
                bullets={buildWrongAnswerBullets({
                  studentAnswer: response,
                  expectedAnswers: expectedAnswersForDisplay.filter(Boolean),
                  guidance: question.guidance,
                  questionText: question.question,
                })}
              />
            ) : null}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="accent"
            onClick={handleSave}
            disabled={
              !(isMultipart
                ? parts.every((p) => hasAnswerContent(p))
                : hasAnswerContent(response)) ||
              saving ||
              aiMarking ||
              Boolean(premiumLockedMessage) ||
              disabled ||
              (!practiceOnly && saved)
            }
            className="gap-2"
          >
            {saving || aiMarking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {aiMarking
              ? "Smart marking…"
              : !practiceOnly && saved
                ? "Submitted"
                : isMultipart
                  ? "Submit all parts"
                  : submitLabel}
          </Button>
          {premiumLockedMessage ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 border-black/10"
              onClick={() => navigate(PREMIUM_PATH)}
            >
              Locked
            </Button>
          ) : null}
        </div>
        {premiumLockedMessage ? (
          <div className="mt-3">
            <PremiumGate allowed={false} message={premiumLockedMessage} />
          </div>
        ) : null}
        {isMultipart && (practiceOnly ? submitted : saved) && partResults.length > 0 ? (
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
        ) : null}
        {isMultipart && (practiceOnly ? submitted : saved) && partResults.length > 0 ? (
          <MultipartMarkBreakdown
            partLabels={slotBreakdownLabels(partLabels, partDescriptors, configuredParts)}
            partResults={partResults}
            partMarks={partMarks}
            expectedAnswers={expectedAnswersForDisplay}
            studentAnswers={parts}
            guidance={question.guidance}
          />
        ) : null}
        {(practiceOnly ? submitted : saved) &&
        autoMarkResult === false &&
        !isMultipart &&
        !aiMark ? (
          <WrongAnswerFeedbackPanel
            bullets={buildWrongAnswerBullets({
              studentAnswer: displayStudentAnswer,
              expectedAnswers: expectedAnswersForDisplay,
              guidance: question.guidance,
              questionText: question.question,
            })}
          />
        ) : null}
        {(practiceOnly ? submitted : saved) && autoMarkResult === true && !isMultipart && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              "bg-success/10 text-success",
            )}
          >
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            <span className="font-medium">Correct! Well done.</span>
          </div>
        )}
        {aiMark && (practiceOnly ? submitted : saved) && !(isMultipart && usesHandwritingAi) ? (
          <AiMarkingFeedbackPanel
            feedback={aiMark.feedback}
            correct={aiMark.correct}
            correctAnswers={aiMark.correctAnswers}
            partResults={aiMark.partResults}
            partLabels={partDescriptors}
          />
        ) : null}
      </div>
      </Fragment>
      )}
    </div>
  );
}
