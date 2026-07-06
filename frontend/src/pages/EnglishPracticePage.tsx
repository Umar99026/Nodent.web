import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_PATHS } from "@/lib/constants";
import { apiFetch } from "@/lib/api";
import { PREMIUM_PATH } from "@/lib/premium";
import { PremiumGate } from "@/components/premium/GetPremiumButton";
import { readImportTextFile } from "@/lib/readImportTextFile";
import type { EnglishEssayResponse } from "@/lib/englishEssay";
import { AnnotatedEssayView } from "@/components/english/AnnotatedEssayView";
import { EnglishCriteriaBreakdown } from "@/components/english/EnglishCriteriaBreakdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Loader2,
  MessageSquareQuote,
  PenLine,
  SendHorizontal,
  Sparkles,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SubmitResult = {
  ok: boolean;
  id?: number;
  aiScore?: {
    score: number;
    summary: string;
    criteria: EnglishEssayResponse["aiCriteria"];
    highlights: EnglishEssayResponse["aiHighlights"];
  } | null;
  aiScoringPending?: boolean;
  aiConfigured?: boolean;
  premiumBlocked?: boolean;
  premiumMessage?: string | null;
};

function mergeResponse(
  base: EnglishEssayResponse | null,
  patch: Partial<EnglishEssayResponse>,
): EnglishEssayResponse | null {
  if (!base && !patch.id) return null;
  return {
    id: patch.id ?? base?.id ?? 0,
    promptId: patch.promptId ?? base?.promptId ?? null,
    customPrompt: patch.customPrompt ?? base?.customPrompt ?? null,
    prompt: patch.prompt ?? base?.prompt ?? "",
    userId: patch.userId ?? base?.userId ?? 0,
    username: patch.username ?? base?.username ?? "",
    responseType: patch.responseType ?? base?.responseType ?? "essay",
    responseText: patch.responseText ?? base?.responseText ?? "",
    imageUrls: patch.imageUrls ?? base?.imageUrls ?? [],
    updatedAt: patch.updatedAt ?? base?.updatedAt ?? "",
    aiScore: patch.aiScore !== undefined ? patch.aiScore : (base?.aiScore ?? null),
    aiFeedback: patch.aiFeedback !== undefined ? patch.aiFeedback : (base?.aiFeedback ?? null),
    aiCriteria: patch.aiCriteria !== undefined ? patch.aiCriteria : (base?.aiCriteria ?? null),
    aiHighlights: patch.aiHighlights ?? base?.aiHighlights ?? [],
    aiScoredAt: patch.aiScoredAt !== undefined ? patch.aiScoredAt : (base?.aiScoredAt ?? null),
  };
}

async function loadEssayResponse(id: number): Promise<EnglishEssayResponse> {
  const data = await apiFetch<{ response: EnglishEssayResponse }>(
    `${API_PATHS.english.responses}/${id}`,
  );
  return data.response;
}

export function EnglishPracticePanel() {
  const navigate = useNavigate();
  const [essayText, setEssayText] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<EnglishEssayResponse | null>(null);
  const [polling, setPolling] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter(
      (f) =>
        f.type.startsWith("text/") ||
        /\.(txt|md)$/i.test(f.name) ||
        f.type === "application/octet-stream",
    );
    if (!list.length) {
      toast.error("Drop a text file (.txt or .md), or paste your essay.");
      return;
    }
    try {
      const parts = await Promise.all(list.slice(0, 3).map((f) => readImportTextFile(f)));
      const merged = parts.join("\n\n").trim();
      if (!merged) {
        toast.error("Could not read text from that file.");
        return;
      }
      setEssayText((prev) => (prev.trim() ? `${prev.trim()}\n\n${merged}` : merged));
      toast.success("Essay loaded from file.");
    } catch {
      toast.error("Could not read that file.");
    }
  }, []);

  const pollForScore = useCallback(async (responseId: number) => {
    setPolling(true);
    try {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        await new Promise((r) => setTimeout(r, 2000));
        const row = await loadEssayResponse(responseId);
        setResult((prev) => mergeResponse(prev, row));
        if (row.aiScore != null) {
          toast.success(`Marked: ${row.aiScore}/10`);
          return;
        }
      }
      toast.message("Marking is taking longer than usual. Check back shortly.");
    } catch {
      toast.error("Could not load marking results.");
    } finally {
      setPolling(false);
    }
  }, []);

  const handleSubmit = async () => {
    const responseText = essayText.trim();
    if (!responseText) {
      toast.error("Paste or upload your essay first.");
      return;
    }
    setSubmitting(true);
    setQuotaMessage(null);
    try {
      const submitResult = await apiFetch<SubmitResult>(API_PATHS.english.responses, {
        method: "POST",
        body: JSON.stringify({
          customPrompt: customPrompt.trim() || undefined,
          responseType: "essay",
          responseText,
        }),
      });

      const base: EnglishEssayResponse = {
        id: submitResult.id ?? 0,
        promptId: null,
        customPrompt: customPrompt.trim() || null,
        prompt: customPrompt.trim(),
        userId: 0,
        username: "",
        responseType: "essay",
        responseText,
        imageUrls: [],
        updatedAt: new Date().toISOString(),
        aiScore: submitResult.aiScore?.score ?? null,
        aiFeedback: submitResult.aiScore?.summary ?? null,
        aiCriteria: submitResult.aiScore?.criteria ?? null,
        aiHighlights: submitResult.aiScore?.highlights ?? [],
        aiScoredAt: submitResult.aiScore ? new Date().toISOString() : null,
      };
      setResult(base);
      setEssayText("");
      setCustomPrompt("");

      if (submitResult.premiumBlocked) {
        const msg =
          submitResult.premiumMessage ??
          "Free accounts get 1 AI-marked English response every 3 days.";
        setQuotaMessage(msg);
        toast.message("Essay saved without AI marking.", { description: msg });
      } else if (submitResult.aiScore?.score != null) {
        toast.success(`Marked: ${submitResult.aiScore.score}/10`);
      } else if (submitResult.aiScoringPending && submitResult.id) {
        toast.message("Essay submitted. Marking in progress…");
        void pollForScore(submitResult.id);
      } else if (responseText.length < 20) {
        toast.success("Essay saved. Write at least 20 characters for marking.");
      } else if (submitResult.aiConfigured === false) {
        toast.success("Essay saved.", {
          description: "AI marking is not configured on the server yet.",
        });
      } else {
        toast.success("Essay submitted.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not submit essay.";
      if (msg.toLowerCase().includes("premium")) {
        setQuotaMessage(msg);
        navigate(PREMIUM_PATH);
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = essayText.trim().length;
  const isEmpty = charCount === 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-14 px-4 py-2 sm:px-8 lg:px-10 lg:py-4">
      {/* Hero */}
      <header className="space-y-4 border-b border-black/8 pb-10">
        <div className="flex items-start gap-5">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#0b0f19] text-white shadow-lg shadow-[#0b0f19]/15">
            <PenLine className="size-7" strokeWidth={1.5} aria-hidden />
          </span>
          <div className="min-w-0 space-y-2 pt-0.5">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-[#0b0f19] sm:text-4xl">
              Essay studio
            </h2>
            <p className="max-w-2xl font-exam-serif text-base leading-relaxed text-[#64748b] sm:text-lg">
              Upload your writing, receive a grade out of ten, and explore inline feedback on
              structure, evidence, expression, and relevance.
            </p>
          </div>
        </div>
      </header>

      {/* Upload */}
      <section className="space-y-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.65fr)] lg:gap-12">
          <div className="space-y-3 lg:pt-2">
            <div className="flex items-center gap-2.5">
              <MessageSquareQuote className="size-5 text-brand" aria-hidden />
              <Label
                htmlFor="english-prompt"
                className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-[#0b0f19]"
              >
                Prompt
              </Label>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Optional — add the question or topic you responded to so marking can check relevance.
            </p>
            <Input
              id="english-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. How does the author explore identity in…"
              className="h-12 rounded-xl border-black/12 bg-white px-4 font-exam-serif text-base shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <FileText className="size-5 text-brand" aria-hidden />
              <Label
                htmlFor="english-essay"
                className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-[#0b0f19]"
              >
                Your essay
              </Label>
            </div>
            <div
              className={cn(
                "relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200",
                dragOver
                  ? "border-brand bg-brand-light/25 shadow-inner"
                  : "border-black/12 bg-[#fefdfb] shadow-sm",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                void ingestFiles(e.dataTransfer.files);
              }}
            >
              {isEmpty ? (
                <div className="pointer-events-none flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                  <span className="flex size-16 items-center justify-center rounded-full bg-black/[0.04]">
                    <Upload className="size-7 text-[#64748b]" strokeWidth={1.5} aria-hidden />
                  </span>
                  <p className="font-display text-sm font-medium text-[#334155]">
                    Drag & drop a .txt file
                  </p>
                  <p className="font-exam-serif text-sm text-muted-foreground">
                    or paste directly below
                  </p>
                </div>
              ) : null}
              <Textarea
                id="english-essay"
                value={essayText}
                onChange={(e) => setEssayText(e.target.value)}
                placeholder="Begin your essay here…"
                rows={isEmpty ? 8 : 18}
                className={cn(
                  "min-h-[320px] resize-y border-0 bg-transparent px-6 py-5 font-exam-serif text-[17px] leading-[1.85] shadow-none focus-visible:ring-0 sm:min-h-[380px] sm:text-[18px]",
                  isEmpty && "min-h-[120px]",
                )}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/8 bg-white/70 px-5 py-3.5 backdrop-blur-sm">
                <p className="font-display text-xs tabular-nums text-muted-foreground">
                  {charCount > 0
                    ? `${charCount.toLocaleString()} characters`
                    : "Supports .txt and .md"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) void ingestFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 rounded-lg border-black/12 bg-white font-display text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Upload file
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-4 border-t border-black/6 pt-8">
          {quotaMessage ? (
            <div className="w-full max-w-xl">
              <PremiumGate allowed={false} message={quotaMessage} />
            </div>
          ) : null}
          <Button
            type="button"
            variant="accent"
            size="lg"
            className="h-12 gap-2.5 rounded-xl px-8 font-display text-base shadow-md"
            disabled={submitting || polling}
            onClick={() => void handleSubmit()}
          >
            {submitting || polling ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <SendHorizontal className="size-5" />
            )}
            Submit for marking
          </Button>
        </div>
      </section>

      {/* Feedback */}
      {result ? (
        <section className="space-y-10 border-t border-black/8 pt-12">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div>
              <h3 className="font-display text-2xl font-semibold tracking-tight text-[#0b0f19]">
                Your feedback
              </h3>
              {result.customPrompt ? (
                <p className="mt-1 max-w-3xl font-exam-serif text-base italic text-[#64748b]">
                  “{result.customPrompt}”
                </p>
              ) : null}
            </div>
          </div>

          {result.aiScore != null || result.aiCriteria ? (
            <EnglishCriteriaBreakdown
              overall={result.aiScore}
              criteria={result.aiCriteria}
              summary={result.aiFeedback}
            />
          ) : polling ? (
            <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-[#f8fafc] px-6 py-8">
              <Loader2 className="size-5 animate-spin text-brand" />
              <p className="font-display text-sm text-[#475569]">Marking your essay…</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Waiting for marking…</p>
          )}

          <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:p-10 lg:p-12">
            <p className="mb-6 font-display text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Annotated essay
            </p>
            <AnnotatedEssayView text={result.responseText} highlights={result.aiHighlights} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Legacy route — peer responses removed. */
export function EnglishPromptResponsesPage() {
  return <EnglishPracticePanel />;
}

export default function EnglishPracticePage() {
  return <EnglishPracticePanel />;
}
