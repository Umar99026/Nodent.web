import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import type { EnglishEssayResponse } from "@/lib/englishEssay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Loader2 } from "lucide-react";

type SharedResponse = Omit<EnglishEssayResponse, "aiCriteria" | "aiHighlights">;

export default function EnglishSharedEssaysPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<SharedResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ responses: SharedResponse[] }>(API_PATHS.english.shared);
        if (cancelled) return;
        setResponses(Array.isArray(data.responses) ? data.responses : []);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load shared essays.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(
    () =>
      responses.filter((r) => String(r.responseText ?? "").trim() && r.aiScore != null && r.aiFeedback),
    [responses],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 lg:px-10">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-black/8 pb-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            English
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-tight text-[#0b0f19] sm:text-3xl">
            Shared essays
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Anonymous essays shared by other students, with the score and feedback they received.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          onClick={() => navigate("/quiz/english")}
        >
          <ArrowLeft className="size-4" />
          Back to marking
        </Button>
      </header>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl border border-black/8 bg-[#f8fafc] px-6 py-8">
          <Loader2 className="size-5 animate-spin text-brand" />
          <p className="font-display text-sm text-[#475569]">Loading essays…</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-danger/20 bg-danger/[0.04] px-6 py-6 text-sm text-danger">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-black/8 bg-white px-6 py-10 text-center">
          <p className="font-display text-base font-medium text-[#0b0f19]">No shared essays yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When students enable sharing, they’ll appear here after being marked.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((r) => (
            <article
              key={r.id}
              className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {r.prompt?.trim() ? "Prompt" : "Essay"}
                  </p>
                  {r.prompt?.trim() ? (
                    <p className="mt-1 font-exam-serif text-sm italic text-[#64748b]">
                      “{r.prompt.trim()}”
                    </p>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "rounded-xl border px-4 py-2 text-right",
                    (r.aiScore ?? 0) >= 8
                      ? "border-success/20 bg-success/5"
                      : (r.aiScore ?? 0) >= 5
                        ? "border-black/10 bg-black/[0.02]"
                        : "border-danger/15 bg-danger/[0.03]",
                  )}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Score
                  </p>
                  <p className="font-display text-2xl font-semibold text-[#0b0f19]">
                    {r.aiScore}/10
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <div className="rounded-xl border border-black/8 bg-[#f8fafc] px-4 py-3 text-sm text-[#334155]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Feedback summary
                  </p>
                  <p className="mt-1 whitespace-pre-wrap font-exam-serif leading-relaxed">
                    {r.aiFeedback}
                  </p>
                </div>

                <details className="rounded-xl border border-black/8 bg-white px-4 py-3">
                  <summary className="cursor-pointer select-none text-sm font-medium text-[#0b0f19]">
                    View full essay
                  </summary>
                  <div className="mt-3 whitespace-pre-wrap font-exam-serif text-[15px] leading-[1.85] text-[#0b0f19]">
                    {r.responseText}
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

