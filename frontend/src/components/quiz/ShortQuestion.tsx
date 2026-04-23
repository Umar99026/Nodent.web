import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn, normalizeAnswer, getQuestionTypeLabel } from "@/lib/utils";
import type { ShortQuestion as ShortQuestionType } from "@/lib/subjects";
import { apiFetch } from "@/lib/api";
import { writtenApiPath } from "@/lib/writtenAnswerUpload";
import { displayMarks, stripQuestionHeadingFromPassage, stripQuestionNumberPrefix } from "@/lib/questionDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PassageBlock, QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { AttachAnswerSection } from "@/components/quiz/AttachAnswerSection";
import { PeerScansDialog } from "@/components/quiz/PeerScansDialog";
import { CheckCircle2, XCircle, Send } from "lucide-react";

interface ShortQuestionProps {
  question: ShortQuestionType;
  onAnswer: (isCorrect: boolean) => void;
  disabled?: boolean;
  hidePassage?: boolean;
  lockedCorrect?: boolean;
  classFullyCorrectPercent?: number | null;
  /** When set with `questionKey`, phone QR upload is shown for visual / diagram questions. */
  subjectId?: string;
  questionKey?: string;
  enableAnswerUpload?: boolean;
}

export function ShortQuestion({
  question,
  onAnswer,
  disabled = false,
  hidePassage = false,
  lockedCorrect = false,
  classFullyCorrectPercent,
  subjectId,
  questionKey,
  enableAnswerUpload = false,
}: ShortQuestionProps) {
  const { user } = useAuth();
  const [answer, setAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [myImages, setMyImages] = useState<string[]>([]);
  const [viewedBeforeSubmit, setViewedBeforeSubmit] = useState(false);
  const [yourPeerRating, setYourPeerRating] = useState<{
    average: number | null;
    count: number;
  }>({ average: null, count: 0 });

  const showUpload =
    Boolean(subjectId && questionKey && enableAnswerUpload);
  const uploadOnlyPrompt =
    showUpload &&
    /\b(draw|sketch|graph|diagram|plot|illustrate|show that|hence show)\b/i.test(
      `${question.question ?? ""} ${question.topic ?? ""} ${question.guidance ?? ""} ${question.passage ?? ""}`,
    );

  useEffect(() => {
    if (lockedCorrect) {
      setSubmitted(true);
      setIsCorrect(true);
      setAnswer(question.acceptedAnswers[0] ?? "—");
    }
  }, [lockedCorrect, question]);

  useEffect(() => {
    if (!showUpload || !subjectId || !questionKey) return;
    let cancelled = false;
    const load = async () => {
      try {
        const data = await apiFetch<{
          response: { text: string; imageUrls?: string[] } | null;
          yourPeerRating?: { average: number | null; count: number };
        }>(writtenApiPath(subjectId, questionKey));
        if (cancelled) return;
        if (data?.yourPeerRating) {
          setYourPeerRating({
            average: data.yourPeerRating.average ?? null,
            count: data.yourPeerRating.count ?? 0,
          });
        }
        if (Array.isArray(data?.response?.imageUrls))
          setMyImages(data.response.imageUrls);
        const t = data?.response?.text?.trim();
        if (t) {
          setAnswer((prev) => (prev.trim() ? prev : t));
        }
      } catch {
        // ignore
      }
    };
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [showUpload, subjectId, questionKey]);

  const canSubmit =
    (!uploadOnlyPrompt && (!!answer.trim() || (showUpload && myImages.length > 0)) &&
      !submitted &&
      !disabled);
  const canSaveUploadOnly =
    uploadOnlyPrompt && showUpload && myImages.length > 0 && !submitted && !disabled;

  const handleSubmit = () => {
    if (!canSubmit) return;

    let correct = false;
    if (answer.trim()) {
      const normalized = normalizeAnswer(answer);
      correct = question.acceptedAnswers.some(
        (accepted) => normalizeAnswer(accepted) === normalized,
      );
    }

    const forfeitsMarks = viewedBeforeSubmit;
    const awardedCorrect = forfeitsMarks ? false : correct;
    setIsCorrect(correct);
    setSubmitted(true);
    onAnswer(awardedCorrect);

    if (showUpload && subjectId && questionKey) {
      void apiFetch(writtenApiPath(subjectId, questionKey), {
        method: "PUT",
        body: JSON.stringify({
          responseText: answer,
          imageUrls: myImages,
        }),
      }).catch(() => {});
    }
  };

  const handleUploadOnlySave = () => {
    if (!canSaveUploadOnly || !showUpload || !subjectId || !questionKey) return;
    setSubmitted(true);
    void apiFetch(writtenApiPath(subjectId, questionKey), {
      method: "PUT",
      body: JSON.stringify({
        responseText: answer,
        imageUrls: myImages,
      }),
    }).catch(() => {});
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

      {showUpload && subjectId && questionKey ? (
        <>
          <AttachAnswerSection
            images={myImages}
            onImagesChange={setMyImages}
            disabled={submitted || disabled}
            inlineAction={
              user ? (
                <PeerScansDialog
                  subjectId={subjectId}
                  questionKey={questionKey}
                  currentUserId={user.id}
                  label="View"
                  className="w-auto border-black/15 bg-white px-4 py-2 text-xs font-semibold"
                  requireConfirmBeforeOpen={!submitted}
                  onViewedBeforeSubmit={() => setViewedBeforeSubmit(true)}
                  modelWorking={{
                    text: question.guidance ?? undefined,
                    imageUrls: question.answerImageUrls ?? [],
                  }}
                />
              ) : null
            }
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
        </>
      ) : null}

      {/* Answer input */}
      <div className="space-y-3">
        {!uploadOnlyPrompt ? (
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
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Upload-only question: submit is disabled. Save your upload for peer review.
            </p>
            <Button
              onClick={handleUploadOnlySave}
              disabled={!canSaveUploadOnly}
              className="gap-2 bg-brand hover:bg-brand-dark"
            >
              Save upload
            </Button>
          </div>
        )}

        {/* Feedback */}
        {submitted && (
          <div
            className={cn(
              "flex items-start gap-3 rounded-lg px-4 py-3 text-sm",
              !answer.trim() && myImages.length > 0
                ? "bg-muted/40 text-foreground"
                : isCorrect
                  ? "bg-success/10 text-success"
                  : "bg-danger/10 text-danger",
            )}
          >
            {!answer.trim() && myImages.length > 0 ? (
              <div>
                <span className="font-medium">Response recorded</span>
                <span className="text-muted-foreground">
                  {" "}
                  (image upload — compare with the solution below)
                </span>
              </div>
            ) : uploadOnlyPrompt ? (
              <div>
                <span className="font-medium">
                  Upload saved for peer review.
                </span>
              </div>
            ) : isCorrect && viewedBeforeSubmit ? (
              <div>
                <span className="font-medium">
                  Correct, but marks are forfeited because you viewed working before submitting.
                </span>
              </div>
            ) : isCorrect ? (
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
