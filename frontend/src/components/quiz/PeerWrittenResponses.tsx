import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { writtenApiPath } from "@/lib/writtenAnswerUpload";
import { QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type Row = {
  userId: number;
  text: string;
  imageUrls?: string[];
  updatedAt?: string;
  peerAverage: number | null;
  peerRatingCount: number;
  myScore: number | null;
};

type Props = {
  subjectId: string;
  questionKey: string;
  /** Hide this user's row so it is not duplicated with “Yours”. */
  currentUserId?: number;
  /** When false, do not fetch (parent uses a toggle). Default true. */
  enabled?: boolean;
  /** Hide the built-in title blurb (e.g. when the dialog already has a title). */
  hideIntro?: boolean;
  className?: string;
};

function PeerRateRow({
  row,
  subjectId,
  questionKey,
  onRated,
}: {
  row: Row;
  subjectId: string;
  questionKey: string;
  onRated: () => void;
}) {
  const [score, setScore] = useState<string>(
    row.myScore != null ? String(row.myScore) : "3",
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScore(row.myScore != null ? String(row.myScore) : "3");
  }, [row.myScore, row.userId]);

  const submit = async () => {
    const n = Number(score);
    if (!Number.isFinite(n) || n < 1 || n > 5) return;
    setSaving(true);
    try {
      await apiFetch(writtenApiPath(subjectId, questionKey, "/rate"), {
        method: "POST",
        body: JSON.stringify({ targetUserId: row.userId, score: n }),
      });
      toast.success("Rating saved.");
      onRated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save rating.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-black/10 pt-3">
      <div className="min-w-[140px] flex-1 space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Your rating (1–5)
        </p>
        <Select
          value={score}
          onValueChange={(v) => v != null && setScore(v)}
          disabled={saving}
        >
          <SelectTrigger className="h-9 bg-white/80 text-sm">
            <SelectValue placeholder="Score" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((s) => (
              <SelectItem key={s} value={String(s)}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0"
        disabled={saving}
        onClick={() => void submit()}
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Save rating"}
      </Button>
      {row.peerRatingCount > 0 ? (
        <p className="w-full text-xs text-muted-foreground">
          Class average for this answer:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {row.peerAverage?.toFixed(1) ?? "—"}
          </span>{" "}
          / 5 ({row.peerRatingCount}{" "}
          {row.peerRatingCount === 1 ? "rating" : "ratings"})
        </p>
      ) : (
        <p className="w-full text-xs text-muted-foreground">No ratings yet.</p>
      )}
    </div>
  );
}

/**
 * Loads all saved responses for this question and shows other students’ text + images.
 * Signed-in users can submit a 1–5 peer rating per other student (upsert).
 */
export function PeerWrittenResponses({
  subjectId,
  questionKey,
  currentUserId,
  enabled = true,
  hideIntro = false,
  className,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ responses: Row[] }>(
        writtenApiPath(subjectId, questionKey, "/all"),
      );
      const list = Array.isArray(data?.responses) ? data.responses : [];
      const others =
        currentUserId != null
          ? list.filter((r) => r.userId !== currentUserId)
          : list;
      setRows(
        others.map((r) => ({
          ...r,
          peerAverage: r.peerAverage ?? null,
          peerRatingCount: r.peerRatingCount ?? 0,
          myScore: r.myScore ?? null,
        })),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [subjectId, questionKey, currentUserId, enabled]);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoading(false);
      setError(null);
      return;
    }
    void load();
  }, [load, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onFocus = () => void load();
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(() => void load(), 45_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(t);
    };
  }, [load, enabled]);

  const hasAny =
    rows.some((r) => (r.text ?? "").trim().length > 0) ||
    rows.some((r) => Array.isArray(r.imageUrls) && r.imageUrls.length > 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-black/10 bg-white/50 p-4",
        className,
      )}
    >
      {!hideIntro ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-foreground">
              Other students&apos; working
            </div>
            <p className="text-xs text-muted-foreground">
              View saved text and attachments. Rate each answer 1–5; authors see the average of
              all ratings they receive.
            </p>
          </div>
          {loading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      ) : (
        loading && (
          <div className="mb-2 flex justify-end">
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
          </div>
        )
      )}

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !hasAny ? (
        <p className="text-sm text-muted-foreground">
          No one else has shared working here yet. Save text or attach images so others can see and
          rate your answer.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 25).map((r, idx) => {
            const hasText = (r.text ?? "").trim().length > 0;
            const imgs = Array.isArray(r.imageUrls) ? r.imageUrls : [];
            if (!hasText && imgs.length === 0) return null;
            return (
              <div
                key={`${r.userId}-${r.updatedAt ?? idx}`}
                className="rounded-lg border border-black/10 bg-white/70 p-3"
              >
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Student ·{" "}
                  {r.updatedAt
                    ? new Date(r.updatedAt).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "recent"}
                </p>
                {hasText ? (
                  <div className="whitespace-pre-wrap text-sm text-foreground/90">
                    {r.text}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">(attachments only)</p>
                )}
                {imgs.length ? (
                  <div className="mt-2">
                    <QuestionImageGrid urls={imgs} title="Uploaded working" />
                  </div>
                ) : null}
                {currentUserId != null ? (
                  <PeerRateRow
                    row={r}
                    subjectId={subjectId}
                    questionKey={questionKey}
                    onRated={load}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
