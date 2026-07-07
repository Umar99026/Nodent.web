import { useNavigate } from "react-router-dom";
import { ChevronRight, Medal, TrendingUp, Trophy } from "lucide-react";

import type { DashboardScorecard } from "@/lib/dashboardRecommendations";
import { formatPercentileBadge } from "@/lib/percentileDisplay";
import { displayTopicLabel, isPlaceholderTopic } from "@/lib/topicDisplay";
import { baseSubjects } from "@/lib/subjects";
import { cn } from "@/lib/utils";

type DashboardReportTableProps = {
  loading?: boolean;
  overallRank?: number | null;
  overallPercentile?: number | null;
  reportSubjects?: DashboardScorecard["reportSubjects"];
};

function subjectName(subjectId: string) {
  return baseSubjects.find((subject) => subject.id === subjectId)?.name ?? subjectId;
}

function formatOverallStanding(value: number | null | undefined) {
  if (value == null) return "—";
  return `Top ${Math.round(value)}%`;
}

function questionCountLabel(count: number) {
  return `${count} ${count === 1 ? "question" : "questions"}`;
}

function rankLabel(rank: number | null | undefined, rankedStudents: number | null | undefined) {
  if (rank == null || !rankedStudents) return "—";
  return `#${rank} / ${rankedStudents}`;
}

function TopicCell({
  topic,
  variant,
}: {
  topic:
    | {
        topic: string;
        percent: number;
        percentile: number | null;
      }
    | null
    | undefined;
  variant: "weak" | "strong";
}) {
  if (!topic || isPlaceholderTopic(topic.topic)) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const label = displayTopicLabel(topic.topic);
  if (!label) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  const pctBadge =
    topic.percentile != null ? formatPercentileBadge(topic.percentile) : null;

  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border px-3 py-2",
        variant === "weak"
          ? "border-rose-200/80 bg-rose-50/70"
          : "border-emerald-200/80 bg-emerald-50/70",
      )}
    >
      <div className="truncate text-sm font-semibold text-[#0b0f19]">{label}</div>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-semibold text-[#0b0f19]">{topic.percent}%</span> marks correct
      </p>
      {pctBadge ? (
        <span
          className={cn(
            "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
            pctBadge.className,
          )}
        >
          {pctBadge.label}
        </span>
      ) : null}
    </div>
  );
}

export function DashboardReportTable({
  loading = false,
  overallRank,
  overallPercentile,
  reportSubjects = [],
}: DashboardReportTableProps) {
  const navigate = useNavigate();

  return (
    <section className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
      <div className="border-b border-black/8 bg-gradient-to-br from-brand/10 via-white to-violet-50/80 px-4 py-4 sm:px-5 sm:py-5">
        <p className="text-xs text-muted-foreground">Tap any subject row for full stats</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-brand/25 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-brand/15 text-brand-deep">
                <TrendingUp className="size-4" aria-hidden />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-deep">
                Overall percentile
              </p>
            </div>
            {loading ? (
              <div className="mt-3 h-8 w-32 animate-pulse rounded-lg bg-black/8" />
            ) : (
              <p className="mt-3 font-display text-2xl font-bold tracking-tight text-[#0b0f19]">
                {formatOverallStanding(overallPercentile)}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-gold/35 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
                <Trophy className="size-4" aria-hidden />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-dark">
                Overall rank
              </p>
            </div>
            {loading ? (
              <div className="mt-3 h-8 w-24 animate-pulse rounded-lg bg-black/8" />
            ) : (
              <p className="mt-3 font-display text-2xl font-bold tracking-tight text-[#0b0f19]">
                {overallRank != null ? `#${overallRank}` : "—"}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-[#f8fafc] text-left">
            <tr className="border-b border-black/8">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-5">
                Subject
              </th>
              <th className="bg-rose-50/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-900/80">
                Weakest topic
              </th>
              <th className="bg-emerald-50/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-900/80">
                Best topic
              </th>
              <th className="bg-sky-50/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-sky-900/80">
                Overall
              </th>
              <th className="bg-amber-50/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-amber-900/80">
                Rank
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <tr key={index} className="border-b border-black/8 last:border-b-0">
                    <td className="px-4 py-4 sm:px-5" colSpan={5}>
                      <div className="h-12 animate-pulse rounded-2xl bg-[#f3f4f6]" />
                    </td>
                  </tr>
                ))
              : reportSubjects.length > 0
                ? reportSubjects.map((row, index) => (
                    <tr
                      key={row.subjectId}
                      onClick={() => navigate(`/quiz/${row.subjectId}/summary`)}
                      className={cn(
                        "cursor-pointer border-b border-black/8 align-top transition-colors last:border-b-0",
                        index % 2 === 0 ? "bg-white" : "bg-[#fafbfc]",
                        "hover:bg-brand/5",
                      )}
                    >
                      <td className="px-4 py-4 sm:px-5">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0b0f19]">
                            {subjectName(row.subjectId)}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {row.attempts > 0
                              ? questionCountLabel(row.attempts)
                              : "Not started yet"}
                          </div>
                        </div>
                      </td>
                      <td className="bg-rose-50/20 px-4 py-4">
                        <TopicCell topic={row.weakestTopic} variant="weak" />
                      </td>
                      <td className="bg-emerald-50/20 px-4 py-4">
                        <TopicCell topic={row.strongestTopic} variant="strong" />
                      </td>
                      <td className="bg-sky-50/20 px-4 py-4">
                        <div className="min-w-0">
                          {row.attempts > 0 ? (
                            <>
                              <p className="text-xs text-muted-foreground">
                                <span className="text-sm font-semibold text-[#0b0f19]">
                                  {row.subjectPercent}%
                                </span>{" "}
                                marks correct
                              </p>
                              {row.percentile != null ? (
                                <span
                                  className={cn(
                                    "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                    formatPercentileBadge(row.percentile).className,
                                  )}
                                >
                                  {formatPercentileBadge(row.percentile).label}
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="bg-amber-50/20 px-4 py-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5 text-sm font-semibold text-[#0b0f19]">
                          <Medal className="size-3.5 text-gold-dark" />
                          {rankLabel(row.rank, row.rankedStudents)}
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </div>
                      </td>
                    </tr>
                  ))
                : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5"
                    >
                      Add subjects on your dashboard to see them here.
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
