import { useEffect, useState, Fragment } from "react";
import { cn, getQuestionTypeLabel, inferDpHintFromAccepted, isAnswerCorrect } from "@/lib/utils";
import type { LongQuestion as LongQuestionType } from "@/lib/subjects";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { writtenApiPath } from "@/lib/writtenAnswerUpload";
import { displayMarks, stripQuestionHeadingFromPassage, stripQuestionNumberPrefix } from "@/lib/questionDisplay";
import { toast } from "sonner";
import {
  Save,
  Lightbulb,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface LongQuestionProps {
  question: LongQuestionType;
  subjectId: string;
  questionKey: string;
  onAnswer: (correct: boolean | null) => void;
  disabled?: boolean;
  hidePassage?: boolean;
  lockedCorrect?: boolean;
  classFullyCorrectPercent?: number | null;
  submitLabel?: string;
  /** Practice-only mode (no API save). Used for wrong-answer review. */
  practiceOnly?: boolean;
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

function splitMarksAcrossParts(totalMarks: number, partCount: number): number[] {
  const safeParts = Math.max(1, partCount);
  const safeTotal = Math.max(1, Math.round(Number(totalMarks) || 1));
  if (safeTotal <= safeParts) {
    return Array(safeParts).fill(1);
  }
  const base = Math.floor(safeTotal / safeParts);
  const rem = safeTotal % safeParts;
  return Array.from({ length: safeParts }, (_, idx) => base + (idx < rem ? 1 : 0));
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
  questionText: string,
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

export function LongQuestion({
  question,
  subjectId,
  questionKey,
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
  submitLabel = "Save Answer",
  practiceOnly = false,
  persistedState,
  onStateChange,
}: LongQuestionProps) {
  const configuredParts: LongQuestionType["answerParts"] = [];
  const partLabels =
    configuredParts.length >= 2
      ? configuredParts.map((p, idx) => p.key?.trim() || `part${idx + 1}`)
      : detectMultipartLabels(question.question);
  const isMultipart = partLabels.length >= 2;
  const partDescriptors =
    configuredParts.length >= 2
      ? configuredParts.map((p) => p.label.trim())
      : detectMultipartDescriptors(question.question, partLabels);
  const effectiveTotalMarks = isMultipart
    ? Math.max(displayMarks(question.marks, question.type), partLabels.length)
    : displayMarks(question.marks, question.type);
  const partMarks = isMultipart
    ? splitMarksAcrossParts(effectiveTotalMarks, partLabels.length)
    : [];
  const expectedAnswersForDisplay = isMultipart
    ? expandAcceptedForMultipart(
        [
          ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : []),
          ...(question.answer ? [question.answer] : []),
        ]
          .map((s) => formatExpectedAnswer(s).trim())
          .filter(Boolean),
      ).map(cleanAcceptedCandidate)
    : [
        ...(
          Array.isArray(question.acceptedAnswers)
            ? question.acceptedAnswers.map((x) => formatExpectedAnswer(x))
            : question.answer
              ? [formatExpectedAnswer(question.answer)]
              : []
        ),
      ];
  const partDpHints = isMultipart
    ? partLabels.map((_, idx) =>
        inferDpHintFromAccepted([expectedAnswersForDisplay[idx] ?? ""]),
      )
    : [];
  const singleDpHint = !isMultipart
    ? inferDpHintFromAccepted([expectedAnswersForDisplay[0] ?? ""])
    : null;
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
        }>(writtenApiPath(subjectId, questionKey));
        if (cancelled) return;
        if (data?.yourPeerRating) {
          setYourPeerRating({
            average: data.yourPeerRating.average ?? null,
            count: data.yourPeerRating.count ?? 0,
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
    const effectiveResponse = isMultipart
      ? partLabels.map((label, idx) => `${label}) ${parts[idx] ?? ""}`.trim()).join("\n")
      : response;
    if (!effectiveResponse.trim() || saving || disabled || (!practiceOnly && saved)) return;

    setSaving(true);
    try {
      if (!practiceOnly) {
        await apiFetch(writtenApiPath(subjectId, questionKey), {
          method: "PUT",
          body: JSON.stringify({
            responseText: effectiveResponse,
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
      if (effectiveResponse.trim() && acceptedPool.length > 0) {
        if (isMultipart) {
          const gradedParts = gradeMultipartIndividually(parts, acceptedPool);
          setPartResults(gradedParts.map((g) => g.correct));
          setDpHint(Math.max(...gradedParts.map((g) => g.dpHint ?? 0)) || null);
          result = gradedParts.every((g) => g.correct);
        } else {
          setPartResults(Array(partLabels.length).fill(null));
          const graded = isAnswerCorrect(effectiveResponse, acceptedPool);
          setDpHint(graded.dpHint);
          result = graded.correct;
        }
      }
      setAutoMarkResult(result);
      onAnswer(result);
      if (result === true) toast.success("Answer submitted. Marked correct.");
      else if (result === false) toast.error("Answer submitted. Not quite right yet.");
      else toast.success("Answer submitted.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit answer."
      );
    } finally {
      setSaving(false);
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
        {effectiveTotalMarks}{" "}
        {effectiveTotalMarks === 1 ? "mark" : "marks"}
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
        <div className="flex items-start gap-3 rounded-lg bg-amber/10 px-4 py-3 text-sm text-amber">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <RichQuestionContent text={question.guidance} className="prose prose-sm max-w-none prose-p:my-0" />
        </div>
      )}

      <QuestionImageGrid
        urls={question.answerImageUrls}
        title="Solution / marking scheme"
      />

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
          <div className="flex flex-col gap-3">
            {partLabels.map((label, idx) => (
              <div key={`${label}-${idx}`} className="space-y-1">
                {(() => {
                  const partUnit = inferPartUnitHint(
                    partDescriptors[idx] ?? "",
                    question.question,
                    expectedAnswersForDisplay[idx],
                  );
                  return (
                    <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">{partDescriptors[idx]}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {partMarks[idx]} {partMarks[idx] === 1 ? "mark" : "marks"}
                  </span>
                </div>
                {(practiceOnly ? submitted : saved) && (
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
                  <Input
                    value={parts[idx] ?? ""}
                    onChange={(e) =>
                      setParts((prev) => {
                        const next = [...prev];
                        next[idx] = e.target.value;
                        return next;
                      })
                    }
                    placeholder="Type your answer..."
                    disabled={disabled || (!practiceOnly && saved)}
                    className={cn(
                      "bg-white/60",
                      partUnit && "rounded-l-none",
                      saved && "border-success/40",
                    )}
                  />
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
                {(practiceOnly ? submitted : saved) && partResults[idx] === false && (
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
          <div className="space-y-2">
            <Textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              placeholder="Write your response here..."
              rows={12}
              disabled={disabled || (!practiceOnly && saved)}
              className={cn(
                "bg-white/60 text-sm leading-relaxed resize-y",
                saved && "border-success/40"
              )}
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {singleDpHint === 2
                  ? "Answer to 2 d.p."
                  : singleDpHint === 0
                    ? "Whole number (no decimals)"
                    : "Any valid format"}
              </span>
            </div>
            {(practiceOnly ? submitted : saved) &&
              autoMarkResult === false &&
              expectedAnswersForDisplay.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Correct answer:{" "}
                  <span className="font-semibold text-foreground">
                    {expectedAnswersForDisplay[0]}
                  </span>
                </p>
              )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={
              !(isMultipart ? parts.join("").trim() : response.trim()) ||
              saving ||
              disabled ||
              (!practiceOnly && saved)
            }
            className="gap-2 bg-brand hover:bg-brand-dark"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {!practiceOnly && saved
              ? "Submitted"
              : isMultipart
                ? "Submit Answer"
                : submitLabel}
          </Button>
        </div>
        {(practiceOnly ? submitted : saved) && autoMarkResult !== null && !isMultipart && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              autoMarkResult
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger",
            )}
          >
            {autoMarkResult ? (
              <>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span className="font-medium">Correct! Well done.</span>
              </>
            ) : (
              <>
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <span className="font-medium">
                  Not quite — keep working on this one.
                </span>
              </>
            )}
          </div>
        )}
      </div>
      </Fragment>
      )}
    </div>
  );
}
