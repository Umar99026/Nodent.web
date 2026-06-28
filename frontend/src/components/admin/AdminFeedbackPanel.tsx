import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquareHeart, RefreshCw } from "lucide-react";
import { apiFetchAdmin } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type FeedbackRow = {
  id: number;
  userId: number | null;
  authorName: string;
  authorEmail: string | null;
  message: string;
  rating: number | null;
  vceStudent: string | null;
  featuresStandOut: string | null;
  createdAt: string;
};

const PAGE_SIZE = 25;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso || "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AdminFeedbackPanel() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFeedback = useCallback(async (nextOffset = 0) => {
    try {
      setLoading(true);
      const data = await apiFetchAdmin<{
        feedback?: FeedbackRow[];
        total?: number;
      }>(`${API_PATHS.admin.feedback}?limit=${PAGE_SIZE}&offset=${nextOffset}`);
      setRows(Array.isArray(data.feedback) ? data.feedback : []);
      setTotal(Number(data.total ?? 0));
      setOffset(nextOffset);
    } catch {
      setRows([]);
      setTotal(0);
      toast.error("Could not load feedback.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeedback(0);
  }, [fetchFeedback]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;

  return (
    <Card className="surface-card">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 font-display text-lg">
            <MessageSquareHeart className="size-5 text-brand" />
            User feedback
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {total} submission{total === 1 ? "" : "s"} from the landing feedback form
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={loading}
          onClick={() => void fetchFeedback(offset)}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading feedback…
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-lg border border-black/10 bg-white/60 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{row.authorName}</p>
                    {row.authorEmail ? (
                      <p className="truncate text-xs text-muted-foreground">{row.authorEmail}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {row.rating != null ? (
                      <Badge variant="secondary" className="rounded-full">
                        {row.rating}/5
                      </Badge>
                    ) : null}
                    {row.vceStudent ? (
                      <Badge variant="outline" className="rounded-full capitalize">
                        VCE: {row.vceStudent}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-muted-foreground">{formatWhen(row.createdAt)}</span>
                  </div>
                </div>
                {row.featuresStandOut ? (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Features that stand out
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#243042]">
                      {row.featuresStandOut}
                    </p>
                  </div>
                ) : null}
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Feedback
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[#243042]">
                    {row.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canPrev || loading}
                onClick={() => void fetchFeedback(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canNext || loading}
                onClick={() => void fetchFeedback(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
