import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ProgressView = "weekly" | "heatmap";

/** Static demo data — mirrors Track My Study weekly line + over-time heatmap. */
const WEEKLY_DAYS = [
  { label: "Mon", minutes: 42 },
  { label: "Tue", minutes: 55 },
  { label: "Wed", minutes: 38 },
  { label: "Thu", minutes: 72 },
  { label: "Fri", minutes: 48 },
  { label: "Sat", minutes: 90 },
  { label: "Sun", minutes: 65 },
] as const;

const GOAL_MINUTES = 60;

const HEATMAP_CELLS = (() => {
  const cells: ("met" | "partial" | "none")[] = [];
  for (let i = 0; i < 140; i++) {
    const r = (i * 19 + 11) % 100;
    if (r < 38) cells.push("met");
    else if (r < 62) cells.push("partial");
    else cells.push("none");
  }
  return cells;
})();

function cellClass(level: "met" | "partial" | "none") {
  if (level === "met") return "bg-emerald-500";
  if (level === "partial") return "bg-emerald-200";
  return "bg-slate-200";
}

export function LandingDemoStudyProgress() {
  const [view, setView] = useState<ProgressView>("heatmap");

  const chartGeometry = useMemo(() => {
    const w = 280;
    const h = 120;
    const padX = 8;
    const padY = 12;
    const maxY = GOAL_MINUTES * 1.15;
    const innerW = w - padX * 2;
    const innerH = h - padY * 2;

    const toX = (i: number) => padX + (i / (WEEKLY_DAYS.length - 1)) * innerW;
    const toY = (mins: number) => padY + innerH - (mins / maxY) * innerH;

    const linePoints = WEEKLY_DAYS.map((d, i) => `${toX(i)},${toY(d.minutes)}`).join(" ");
    const dots = WEEKLY_DAYS.map((d, i) => ({ x: toX(i), y: toY(d.minutes), label: d.label }));
    const goalY = toY(GOAL_MINUTES);

    return { w, h, linePoints, dots, goalY };
  }, []);

  return (
    <div className="landing-demo-step space-y-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-semibold text-[#0b0f19] sm:text-base">
          {view === "weekly" ? "Weekly Progress" : "Over-time Heatmap"}
        </p>
        <div className="inline-flex shrink-0 rounded-lg border border-black/10 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setView("weekly")}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
              view === "weekly"
                ? "bg-[#0b0f19] text-white"
                : "text-[#0b0f19]/70 hover:bg-black/5",
            )}
          >
            Weekly
          </button>
          <button
            type="button"
            onClick={() => setView("heatmap")}
            className={cn(
              "h-7 rounded-md px-2.5 text-xs font-medium transition-colors",
              view === "heatmap"
                ? "bg-[#0b0f19] text-white"
                : "text-[#0b0f19]/70 hover:bg-black/5",
            )}
          >
            Heatmap
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-black/10 bg-slate-50 px-3 py-2">
        <span className="text-xs text-[#0b0f19]/70">This week total</span>
        <span className="text-sm font-semibold tabular-nums text-[#0b0f19]">6h 50m</span>
      </div>

      {view === "weekly" ? (
        <div className="space-y-2">
          <svg
            viewBox={`0 0 ${chartGeometry.w} ${chartGeometry.h}`}
            className="mx-auto h-[140px] w-full max-w-[300px]"
            aria-hidden
          >
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = 12 + (120 - 24) * (1 - t);
              return (
                <line
                  key={t}
                  x1={8}
                  x2={272}
                  y1={y}
                  y2={y}
                  stroke="rgba(0,0,0,0.08)"
                  strokeDasharray="3 3"
                />
              );
            })}
            <line
              x1={8}
              x2={272}
              y1={chartGeometry.goalY}
              y2={chartGeometry.goalY}
              stroke="rgba(15,23,42,0.4)"
              strokeWidth={1.5}
              strokeDasharray="6 6"
            />
            <polyline
              points={chartGeometry.linePoints}
              fill="none"
              stroke="#56abe6"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {chartGeometry.dots.map((d) => (
              <circle key={d.label} cx={d.x} cy={d.y} r={3.5} fill="#56abe6" />
            ))}
          </svg>
          <div className="flex justify-between px-1 text-[10px] text-slate-500">
            {WEEKLY_DAYS.map((d) => (
              <span key={d.label}>{d.label}</span>
            ))}
          </div>
          <p className="text-center text-[10px] text-slate-500">
            Daily study minutes vs your {GOAL_MINUTES} min goal
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
          >
            {HEATMAP_CELLS.map((level, i) => (
              <div
                key={i}
                className={cn("aspect-square w-full max-w-[14px] rounded-[3px]", cellClass(level))}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[#0b0f19]/65 sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-emerald-500" />
              target met
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-emerald-200" />
              studied, below target
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[3px] bg-slate-200" />
              no study
            </span>
          </div>
          <p className="text-center text-[10px] text-slate-500">
            Last 20 weeks — same view as Track My Study
          </p>
        </div>
      )}
    </div>
  );
}
