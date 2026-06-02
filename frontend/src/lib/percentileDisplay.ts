/** Round to the nearest 2 (e.g. 66.7 → 66, 67.3 → 68). */
export function roundPercentileToNearest2(value: number): number {
  return Math.round(value / 2) * 2;
}

/**
 * “Top X%” band from leaderboard rank (1 = best).
 * Rank 2 of 10 → 20 (top 20%). Values are rounded to the nearest 2%.
 */
export function cohortPercentileFromRank(rank: number, total: number): number {
  if (total < 1 || rank < 1 || rank > total) return 0;
  const raw = (rank / total) * 100;
  return Math.max(2, Math.min(100, roundPercentileToNearest2(raw)));
}

export function formatPercentileBadge(percentile: number): {
  label: string;
  className: string;
} {
  const p = Math.max(0, Math.min(100, Math.round(percentile)));
  const label = `Top ${p}%`;
  if (p <= 20) return { label, className: "bg-success/15 text-success" };
  if (p <= 40) return { label, className: "bg-brand/15 text-brand-dark" };
  if (p <= 60) return { label, className: "bg-amber/15 text-amber" };
  return { label, className: "bg-muted text-muted-foreground" };
}
