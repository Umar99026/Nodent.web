import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type LandingDashboardMockupProps = {
  className?: string;
  compact?: boolean;
};

export function LandingDashboardMockup({ className, compact }: LandingDashboardMockupProps) {
  return (
    <div
      className={cn(
        "landing-hero-float relative z-0 mx-auto w-full",
        compact ? "max-w-lg" : "max-w-3xl lg:max-w-4xl",
        className,
      )}
    >
      <div
        className={cn(
          "landing-mockup-main glass-card grain-texture overflow-hidden rounded-2xl border-2 border-white/80 bg-white shadow-2xl shadow-brand/20 sm:rounded-3xl",
          !compact && "lg:scale-[1.02]",
        )}
      >
        <div className="flex items-center gap-2.5 border-b-2 border-slate-100 bg-slate-50 px-5 py-4 sm:px-6 sm:py-4">
          <span className="size-3 rounded-full bg-red-400/80" />
          <span className="size-3 rounded-full bg-amber-400/80" />
          <span className="size-3 rounded-full bg-emerald-400/80" />
          <span className="ml-2 text-sm font-medium text-slate-500">Nodent · Dashboard</span>
        </div>
        <div className={cn("space-y-5", compact ? "p-5" : "p-6 sm:p-7")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Report card
              </p>
              <p className="font-display text-2xl font-bold text-[#0b0f19]">72nd percentile</p>
            </div>
            <div className="rounded-xl bg-brand/10 px-3 py-2 text-sm font-semibold text-brand-dark">
              Rank #18 ↑6
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            {["Methods", "English", "General"].map((s, i) => (
              <div
                key={s}
                className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm sm:p-4"
              >
                <p className="text-[10px] font-medium text-slate-500">{s}</p>
                <p className="mt-1 font-semibold text-[#0b0f19]">
                  {i === 0 ? "84%" : i === 1 ? "71%" : "68%"}
                </p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-brand/15 bg-gradient-to-br from-brand/5 to-white p-4">
            <p className="text-sm font-medium text-slate-700">Weakest topic</p>
            <p className="mt-1 font-display text-lg font-semibold text-brand-dark">
              Calculus · integration
            </p>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100 sm:h-3">
              <div className="landing-progress-bar h-full w-[68%] rounded-full bg-brand" />
            </div>
          </div>
        </div>
      </div>
      {!compact ? (
        <>
          <div className="landing-mockup-card glass-card absolute -bottom-6 -left-4 hidden w-44 rounded-xl border border-white/70 p-3 shadow-xl sm:block">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-brand" />
              <p className="text-xs font-semibold text-[#0b0f19]">Live rankings</p>
            </div>
          </div>
          <div className="landing-mockup-card-alt glass-card absolute -right-2 top-8 hidden w-40 rounded-xl border border-white/70 p-3 shadow-xl sm:block">
            <p className="text-[10px] text-slate-500">This session</p>
            <p className="text-sm font-semibold text-[#0b0f19]">8 / 10 correct</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
