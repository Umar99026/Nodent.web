import { ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTopicPerformance } from "@/hooks/useTopicPerformance";
import {
  topicPerformanceColors,
  topicPerformancePercent,
} from "@/lib/topicPerformanceColor";
import { cn } from "@/lib/utils";

type TopicPerformanceSelectProps = {
  subjectId: string | undefined;
  value: string;
  onValueChange: (value: string) => void;
  topics: string[];
  /** When true, prepends an "all" option (value `all`). */
  includeAllOption?: boolean;
  allOptionLabel?: string;
  placeholder?: string;
  className?: string;
};

function TopicOptionRow({
  label,
  percent,
}: {
  label: string;
  percent: number | null;
}) {
  const colors = topicPerformanceColors(percent);
  return (
    <span className="flex items-center gap-2">
      <span
        className={cn("h-3 w-1 shrink-0 rounded-full", colors.stripe)}
        style={colors.stripeStyle}
        aria-hidden
      />
      <span className="whitespace-nowrap font-medium" style={colors.labelStyle}>
        {label}
      </span>
      {percent != null ? (
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums",
            colors.badge,
          )}
          style={colors.badgeStyle}
        >
          {percent}%
        </span>
      ) : null}
    </span>
  );
}

export function TopicPerformanceSelect({
  subjectId,
  value,
  onValueChange,
  topics,
  includeAllOption = false,
  allOptionLabel = "All topics",
  placeholder = "Choose topic",
  className,
}: TopicPerformanceSelectProps) {
  const { getStat } = useTopicPerformance(subjectId);

  const selectedPercent = value === "all" ? null : topicPerformancePercent(getStat(value));
  const selectedLabel =
    value === "all" ? allOptionLabel : topics.includes(value) ? value : placeholder;

  return (
    <div className={cn("w-[min(100%,12.5rem)] sm:w-[min(100%,13.5rem)]", className)}>
      <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
        <SelectTrigger
          hideDefaultIcon
          title={selectedLabel}
          className={cn(
            "topic-performance-select-trigger h-10 w-full gap-0 rounded-xl border border-black/10 bg-brand-light p-0 text-sm text-[#0b0f19] shadow-none",
            "focus-visible:border-black/15 focus-visible:ring-0",
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left">
            {value !== "all" ? (
              <span
                className={cn(
                  "h-3 w-1 shrink-0 rounded-full",
                  topicPerformanceColors(selectedPercent).stripe,
                )}
                style={topicPerformanceColors(selectedPercent).stripeStyle}
                aria-hidden
              />
            ) : (
              <span className="w-1 shrink-0" aria-hidden />
            )}
            <SelectValue placeholder={placeholder} className="min-w-0 truncate" />
          </span>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center border-l border-black/10"
            aria-hidden
          >
            <ChevronDown className="size-5 stroke-[2.5] text-[#0b0f19]/80" />
          </span>
        </SelectTrigger>
        <SelectContent
          alignItemWithTrigger={false}
          className="max-h-80 w-max min-w-[var(--anchor-width)] max-w-[min(100vw-1.5rem,26rem)]"
        >
          {includeAllOption ? (
            <SelectItem value="all" className="py-2">
              <TopicOptionRow label={allOptionLabel} percent={null} />
            </SelectItem>
          ) : null}
          {topics.map((topic) => {
            const percent = topicPerformancePercent(getStat(topic));
            const colors = topicPerformanceColors(percent);
            return (
              <SelectItem
                key={topic}
                value={topic}
                className="py-2"
                style={colors.itemBgStyle}
              >
                <TopicOptionRow label={topic} percent={percent} />
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
