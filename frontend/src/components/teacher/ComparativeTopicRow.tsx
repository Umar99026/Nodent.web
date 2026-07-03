import { Badge } from "@/components/ui/badge";
import { formatPercentileBadge } from "@/lib/percentileDisplay";
import { cn } from "@/lib/utils";
import { AlertTriangle, Star } from "lucide-react";

export type ComparativeTopicRowData = {
  topic: string;
  subjectId?: string;
  percent: number;
  marksAttempted?: number;
  platformPercent?: number | null;
  vsPlatform?: number | null;
  topicPercentile?: number | null;
  studentsAttempted?: number;
};

type ComparativeTopicRowProps = {
  row: ComparativeTopicRowData;
  label?: string;
  subjectName?: string;
  showSubject?: boolean;
  compact?: boolean;
  benchmarkLabel?: string;
};

export function comparativeBarColor(
  percent: number,
  platformPercent: number | null | undefined,
): string {
  if (platformPercent == null) {
    if (percent < 50) return "bg-danger";
    if (percent >= 80) return "bg-success";
    return "bg-amber";
  }
  if (percent < platformPercent) return "bg-danger";
  if (percent > platformPercent) return "bg-success";
  return "bg-amber";
}

function topicPercentileBadge(percentile: number) {
  const base = formatPercentileBadge(percentile);
  if (percentile > 60) {
    return { label: base.label, className: "bg-danger/15 text-danger" };
  }
  return base;
}

export function ComparativeTopicRow({
  row,
  label = "Class",
  subjectName,
  showSubject = false,
  compact = false,
  benchmarkLabel = "Others",
}: ComparativeTopicRowProps) {
  const platform = row.platformPercent;
  const deltaValue =
    row.vsPlatform != null
      ? row.vsPlatform
      : platform != null
        ? row.percent - platform
        : null;
  const below = platform != null ? row.percent < platform : row.percent < 50;
  const above = platform != null ? row.percent > platform : row.percent >= 80;
  const isWeak = below;
  const isStrong = above;
  const tpBadge =
    row.topicPercentile != null ? topicPercentileBadge(row.topicPercentile) : null;
  const delta =
    deltaValue != null
      ? `${deltaValue > 0 ? "+" : ""}${deltaValue}%`
      : null;

  return (
    <div
      className={cn(
        "space-y-1.5 rounded-lg",
        compact && "space-y-1",
        below && "border border-danger/25 bg-danger/5 px-2.5 py-2",
        above && !below && "border border-success/20 bg-success/5 px-2.5 py-2",
        !below && !above && platform != null && "px-0.5 py-1",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("font-medium text-[#0b0f19]", compact ? "text-sm" : "text-sm")}>
              {row.topic}
            </span>
            {tpBadge ? (
              <Badge className={cn("text-[10px]", tpBadge.className)}>{tpBadge.label}</Badge>
            ) : null}
            {isWeak ? (
              <Badge variant="outline" className="border-danger/40 bg-danger/10 text-[10px] text-danger">
                Below avg
              </Badge>
            ) : null}
            {isStrong ? <Star className="size-3.5 shrink-0 fill-amber text-amber" /> : null}
            {isWeak ? <AlertTriangle className="size-3.5 shrink-0 text-danger" /> : null}
          </div>
          {showSubject && subjectName ? (
            <div className="text-[11px] text-muted-foreground">
              {subjectName}
              {row.studentsAttempted != null ? ` · ${row.studentsAttempted} in class` : ""}
            </div>
          ) : null}
        </div>
        <div className="shrink-0 text-right text-xs tabular-nums">
          <div
            className={cn(
              "font-semibold",
              below && "text-danger",
              above && "text-success",
              !below && !above && "text-foreground",
            )}
          >
            {label}: {row.percent}%
          </div>
          <div className={cn("text-muted-foreground", below && "text-danger/80")}>
            {benchmarkLabel}: {platform != null ? `${platform}%` : "—"}
          </div>
          {delta != null ? (
            <div
              className={cn(
                "font-semibold",
                deltaValue! > 0
                  ? "text-success"
                  : deltaValue! < 0
                    ? "text-danger"
                    : "text-muted-foreground",
              )}
            >
              {delta} vs avg
            </div>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          {platform != null ? (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-danger/20"
              style={{ width: `${Math.max(0, Math.min(100, platform))}%` }}
              aria-hidden
            />
          ) : null}
          <div
            className={cn(
              "relative h-full rounded-full transition-all",
              comparativeBarColor(row.percent, platform),
            )}
            style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
          />
        </div>
        {platform != null ? (
          <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
            <span>0%</span>
            <span className={cn(below && "font-medium text-danger")}>
              {benchmarkLabel} avg {platform}%
            </span>
            <span>100%</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
