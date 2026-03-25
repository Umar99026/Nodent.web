import { useState } from "react";
import { cn, getQuestionTypeLabel } from "@/lib/utils";
import type { LongQuestion as LongQuestionType } from "@/lib/subjects";
import { apiFetch } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Save,
  Users,
  ChevronUp,
  BookOpen,
  Lightbulb,
  Loader2,
} from "lucide-react";

interface LongQuestionProps {
  question: LongQuestionType;
  subjectId: string;
  questionKey: string;
  onAnswer: (correct: boolean | null) => void;
  disabled?: boolean;
}

interface StudentResponse {
  userId: number;
  text: string;
  updatedAt?: string;
}

function QuestionImages({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {urls.slice(0, 4).map((src) => (
        <div
          key={src}
          className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"
        >
          <img
            src={src}
            alt="Question image"
            className="h-52 w-full object-cover"
            loading="lazy"
          />
        </div>
      ))}
    </div>
  );
}

function normalizeForMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreLongAnswer(
  response: string,
  acceptedAnswers?: string[],
  answer?: string,
  fallbackText?: string,
): boolean {
  const accepted = [
    ...(acceptedAnswers ?? []).map((x) => x.trim()).filter(Boolean),
    ...(answer ? [answer.trim()] : []),
  ].filter(Boolean);

  const resp = normalizeForMatch(response);
  if (!resp) return false;

  // If we have accepted answers, use deterministic matching.
  for (const acc of accepted) {
    const accNorm = normalizeForMatch(acc);
    if (!accNorm) continue;

    // Exact / containment match (works well for phrases)
    if (resp.includes(accNorm) || accNorm.includes(resp)) return true;

    // Fallback: word overlap ratio
    const respWords = new Set(resp.split(" ").filter(Boolean));
    const accWords = accNorm.split(" ").filter(Boolean);
    if (accWords.length === 0) continue;

    let intersect = 0;
    for (const w of accWords) {
      if (respWords.has(w)) intersect++;
    }

    const ratio = intersect / accWords.length;
    if (ratio >= 0.55) return true;
  }

  // Fallback heuristic when no accepted answers are available:
  // consider the response correct if it overlaps meaningful tokens from
  // passage/guidance/question metadata.
  if (accepted.length > 0) return false;

  const src = normalizeForMatch(fallbackText ?? "");
  const respWords = new Set(resp.split(" ").filter(Boolean));

  if (respWords.size < 10) return false;

  const stop = new Set([
    "the",
    "and",
    "with",
    "from",
    "that",
    "this",
    "there",
    "which",
    "would",
    "could",
    "should",
    "into",
    "about",
    "over",
    "under",
    "then",
    "than",
    "because",
    "your",
    "their",
    "have",
    "has",
    "had",
  ]);

  const tokens = src
    .split(" ")
    .filter((w) => w.length >= 6 && !stop.has(w));
  const uniqTokens = Array.from(new Set(tokens)).slice(0, 30);

  if (uniqTokens.length === 0) {
    // Last resort: long enough response counts.
    return response.trim().length >= 120;
  }

  let matches = 0;
  for (const t of uniqTokens) {
    if (respWords.has(t)) matches++;
  }

  const threshold = Math.max(2, Math.floor(uniqTokens.length * 0.15));
  return matches >= threshold;
}

export function LongQuestion({
  question,
  subjectId,
  questionKey,
  onAnswer,
  disabled = false,
}: LongQuestionProps) {
  const [response, setResponse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [otherResponses, setOtherResponses] = useState<StudentResponse[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  const [loadingOthers, setLoadingOthers] = useState(false);

  const handleSave = async () => {
    if (!response.trim() || saving || disabled) return;

    setSaving(true);
    try {
      await apiFetch(`/api/written/${subjectId}/${questionKey}`, {
        method: "PUT",
        body: JSON.stringify({ responseText: response }),
      });
      setSaved(true);
      toast.success("Answer saved successfully.");
      const correct = scoreLongAnswer(
        response,
        question.acceptedAnswers,
        question.answer,
        [question.passage, question.guidance, question.topic, question.question]
          .filter(Boolean)
          .join(" "),
      );
      onAnswer(correct);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save answer."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleViewOthers = async () => {
    if (showOthers) {
      setShowOthers(false);
      return;
    }

    setLoadingOthers(true);
    try {
      const data = await apiFetch<{ responses: StudentResponse[] }>(
        `/api/written/${subjectId}/${questionKey}/all`
      );
      setOtherResponses(data.responses ?? []);
      setShowOthers(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load responses."
      );
    } finally {
      setLoadingOthers(false);
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
        <h3 className="font-display text-lg leading-relaxed text-foreground sm:text-xl">
          {question.question}
        </h3>
      </div>

      <QuestionImages urls={question.imageUrls} />

      {/* Passage */}
      {question.passage && (
        <Card className="border-l-4 border-l-brand/40 bg-muted/60">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BookOpen className="size-4" />
              Passage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <blockquote className="text-sm leading-relaxed text-foreground/80">
              {question.passage}
            </blockquote>
          </CardContent>
        </Card>
      )}

      {/* Guidance */}
      {question.guidance && (
        <div className="flex items-start gap-3 rounded-lg bg-amber/10 px-4 py-3 text-sm text-amber">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <span>{question.guidance}</span>
        </div>
      )}

      {/* Answer textarea */}
      <div className="space-y-3">
        <Textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Write your response here..."
          rows={12}
          disabled={disabled}
          className={cn(
            "bg-white/60 text-sm leading-relaxed resize-y",
            saved && "border-success/40"
          )}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleSave}
            disabled={!response.trim() || saving || disabled}
            className="gap-2 bg-brand hover:bg-brand-dark"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {saved ? "Update Answer" : "Save Answer"}
          </Button>

          <Button
            variant="outline"
            onClick={handleViewOthers}
            disabled={loadingOthers}
            className="gap-2"
          >
            {loadingOthers ? (
              <Loader2 className="size-4 animate-spin" />
            ) : showOthers ? (
              <ChevronUp className="size-4" />
            ) : (
              <Users className="size-4" />
            )}
            {showOthers ? "Hide Responses" : "View Other Responses"}
          </Button>
        </div>

        {saved && (
          <p className="text-xs font-medium text-success">
            Your answer has been saved.
          </p>
        )}
      </div>

      {/* Other student responses */}
      {showOthers && (
        <div className="space-y-3">
          <Separator />
          <h4 className="font-display text-base font-medium text-foreground">
            Other Student Responses
          </h4>

          {otherResponses.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              No other responses yet.
            </p>
          ) : (
            <div className="space-y-3">
                {otherResponses.map((resp, index) => (
                  <Card
                    key={`${resp.userId}-${resp.updatedAt ?? index}`}
                    className="bg-white/50"
                    size="sm"
                  >
                  <CardHeader className="pb-1">
                    <CardTitle className="text-sm font-medium text-brand-dark">
                      Student {index + 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                      {resp.text}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
