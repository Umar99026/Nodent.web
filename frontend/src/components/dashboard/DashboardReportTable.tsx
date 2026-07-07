import { useNavigate } from "react-router-dom";
import { BarChart3, ChevronRight, Medal } from "lucide-react";

import type { DashboardScorecard } from "@/lib/dashboardRecommendations";
import { displayTopicLabel } from "@/lib/topicDisplay";
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

function ordinalPercentile(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Math.round(value)}th pct`;
}

function rankLabel(rank: number | null | undefined, rankedStudents: number | null | undefined) {
  if (rank == null || !rankedStudents) return "—";
  return `#${rank} / ${rankedStudents}`;
}

function TopicCell({
  topic,
}: {
  topic:
    | {
        topic: string;
        percent: number;
        percentile: number | null;
      }
    | null
    | undefined;
}) {
  if (!topic) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-[#0b0f19]">
        {displayTopicLabel(topic.topic)}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">
        {topic.percent}% correct
        {topic.percentile != null ? ` · ${Math.round(topic.percentile)}th pct` : ""}
      </div>
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
      <div className="practice-card-header !min-h-0 !py-3.5 sm:!py-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-4 shrink-0 text-brand" aria-hidden />
          <p className="practice-card-header-title">Report</p>
        </div>
        <p className="practice-card-header-meta">
          {ordinalPercentile(overallPercentile)}
          {overallRank != null ? ` · #${overallRank}` : ""}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-[#f8fafc] text-left">
            <tr className="border-b border-black/8">
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-5">
                Subject
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Weakest topic
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Best topic
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Overall
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
                ? reportSubjects.map((row) => (
                    <tr
                      key={row.subjectId}
                      onClick={() => navigate(`/quiz/${row.subjectId}/summary`)}
                      className={cn(
                        "cursor-pointer border-b border-black/8 align-top transition-colors last:border-b-0",
                        "hover:bg-[#f8fafc]",
                      )}
                    >
                      <td className="px-4 py-4 sm:px-5">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0b0f19]">
                            {subjectName(row.subjectId)}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {row.attempts} attempts
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <TopicCell topic={row.weakestTopic} />
                      </td>
                      <td className="px-4 py-4">
                        <TopicCell topic={row.strongestTopic} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-[#0b0f19]">
                            {row.subjectPercent}%
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {ordinalPercentile(row.percentile)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b0f19]">
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
                      Complete a bit more practice to unlock your report.
                    </td>
                  </tr>
                )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
