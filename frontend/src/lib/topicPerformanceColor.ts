import type { CSSProperties } from "react";

/** Minimum mark attempts before we color-code a topic (avoids red/green on one question). */
export const TOPIC_PERFORMANCE_MIN_MARKS = 3;

export type TopicPerformanceSnapshot = {
  myCorrect: number | null;
  myTotal: number;
};

export function topicPerformancePercent(
  stat: TopicPerformanceSnapshot | undefined,
): number | null {
  if (!stat || stat.myTotal < TOPIC_PERFORMANCE_MIN_MARKS || stat.myCorrect == null) {
    return null;
  }
  return Math.round((stat.myCorrect / stat.myTotal) * 100);
}

/** Green at 100%, red at 0%. Returns null when there is not enough data. */
export function topicPerformanceHue(percent: number | null): number | null {
  if (percent == null) return null;
  const clamped = Math.max(0, Math.min(100, percent));
  return Math.round((clamped / 100) * 120);
}

export function topicPerformanceColors(percent: number | null) {
  const hue = topicPerformanceHue(percent);
  if (hue == null) {
    return {
      stripe: "bg-muted-foreground/35",
      itemBg: "",
      itemBgStyle: undefined as CSSProperties | undefined,
      label: "",
      badge: "text-muted-foreground",
      badgeStyle: undefined as CSSProperties | undefined,
    };
  }
  return {
    stripe: "",
    stripeStyle: { backgroundColor: `hsl(${hue} 78% 32%)` } as CSSProperties,
    itemBg: "",
    itemBgStyle: { backgroundColor: `hsl(${hue} 42% 90%)` } as CSSProperties,
    label: "",
    labelStyle: { color: `hsl(${hue} 55% 18%)` } as CSSProperties,
    badge: "",
    badgeStyle: {
      color: `hsl(${hue} 60% 22%)`,
      backgroundColor: `hsl(${hue} 48% 82%)`,
    } as CSSProperties,
  };
}
