import { useEffect, useState, Fragment } from "react";
import { cn, getQuestionTypeLabel, normalizeAnswer } from "@/lib/utils";
import type { LongQuestion as LongQuestionType } from "@/lib/subjects";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}: LongQuestionProps) {
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autoMarkResult, setAutoMarkResult] = useState<boolean | null>(null);
  const [yourPeerRating, setYourPeerRating] = useState<{
    average: number | null;
    count: number;
  }>({ average: null, count: 0 });

  useEffect(() => {
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
          if (t) setResponse((prev) => (prev.trim() ? prev : t));
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
  }, [subjectId, questionKey]);

  const handleSave = async () => {
    if (!response.trim() || saving || disabled || saved) return;

    setSaving(true);
    try {
      await apiFetch(writtenApiPath(subjectId, questionKey), {
        method: "PUT",
        body: JSON.stringify({
          responseText: response,
        }),
      });
      setSaved(true);
      const acceptedPool = [
        ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : []),
        ...(question.answer ? [question.answer] : []),
      ]
        .map((s) => String(s).trim())
        .filter(Boolean);
      let result: boolean | null = null;
      if (response.trim() && acceptedPool.length > 0) {
        const normalized = normalizeAnswer(response);
        result = acceptedPool.some(
          (accepted) => normalizeAnswer(accepted) === normalized,
        );
      }
      setAutoMarkResult(result);
      onAnswer(result);
      if (result === true) toast.success("Answer saved. Marked correct.");
      else if (result === false)
        toast.error("Answer saved. Not quite right yet.");
      else toast.success("Answer saved.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save answer."
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
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Write your response here..."
          rows={12}
          disabled={disabled || saved}
          className={cn(
            "bg-white/60 text-sm leading-relaxed resize-y",
            saved && "border-success/40"
          )}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={
              !response.trim() || saving || disabled || saved
            }
            className="gap-2 bg-brand hover:bg-brand-dark"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saved ? "Saved" : "Save Answer"}
          </Button>
        </div>
        {saved && autoMarkResult !== null && (
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
