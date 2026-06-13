import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Check, ChevronUp, Trophy } from "lucide-react";
import { LANDING_DEMO_STEPS } from "@/components/landing/landingDemoSteps";
import { LandingDemoStudyProgress } from "@/components/landing/LandingDemoStudyProgress";

type LandingDemoAnimationProps = {
  stepIndex: number;
  onStepIndexChange: (index: number) => void;
};

export function LandingDemoAnimation({
  stepIndex,
  onStepIndexChange,
}: LandingDemoAnimationProps) {
  const step = LANDING_DEMO_STEPS[stepIndex] ?? LANDING_DEMO_STEPS[0]!;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      onStepIndexChange((stepIndex + 1) % LANDING_DEMO_STEPS.length);
    }, step.durationMs);
    return () => window.clearTimeout(t);
  }, [stepIndex, step.durationMs, onStepIndexChange]);

  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 600);
    return () => window.clearInterval(iv);
  }, []);

  return (
    <div
      id="demo-animation-panel"
      className="landing-demo-frame relative"
      role="tabpanel"
      aria-label={step.label}
    >
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-brand/20 via-brand-light/10 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-xs font-medium text-slate-500">Nodent · Live preview</span>
          <div className="flex gap-1" aria-hidden>
            {LANDING_DEMO_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  i === stepIndex ? "w-6 bg-brand" : "w-1.5 bg-slate-200",
                )}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[280px] p-5 sm:p-6">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-brand-dark">
            {step.label}
          </p>

          {step.id === "subject" && (
            <div className="landing-demo-step grid grid-cols-2 gap-2 sm:grid-cols-3">
              {["Methods", "English", "General"].map((s, i) => (
                <div
                  key={s}
                  className={cn(
                    "rounded-xl border p-3 text-center text-sm font-medium transition-all duration-500",
                    i === 0
                      ? "border-brand bg-brand/10 text-brand-dark shadow-sm"
                      : "border-slate-100 bg-slate-50 text-slate-500",
                  )}
                >
                  {s}
                </div>
              ))}
            </div>
          )}

          {step.id === "answer" && (
            <div className="landing-demo-step space-y-3">
              <p className="text-sm font-medium text-[#0b0f19]">
                Find the derivative of y = x² cos(x)
              </p>
              <div className="overflow-x-auto rounded-lg border border-brand/30 bg-brand/5 px-3 py-2.5 font-mono text-sm text-slate-700">
                <span className="whitespace-nowrap">2x cos(x) − x² sin(x)</span>
                <span className="landing-demo-cursor ml-0.5 inline-block h-4 w-0.5 bg-brand" />
              </div>
              <div className="flex justify-end">
                <span className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white">
                  Submit
                </span>
              </div>
            </div>
          )}

          {step.id === "score" && (
            <div className="landing-demo-step flex flex-col items-center justify-center py-4">
              <div className="relative flex size-28 items-center justify-center rounded-full border-4 border-brand/20 bg-brand/5">
                <span className="font-display text-3xl font-bold text-brand-dark">8/10</span>
                <span className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-4" />
                </span>
              </div>
              <p className="mt-4 text-sm text-slate-600">Instant feedback — marked in seconds</p>
            </div>
          )}

          {step.id === "rank" && (
            <div className="landing-demo-step space-y-2">
              {[
                { name: "You", rank: tick % 2 === 1 ? 18 : 24, you: true },
                { name: "Alex M.", rank: 12, you: false },
                { name: "Sam K.", rank: 15, you: false },
              ].map((row) => (
                <div
                  key={row.name}
                  className={cn(
                    "flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all duration-500",
                    row.you
                      ? "border-brand/30 bg-brand/10"
                      : "border-slate-100 bg-white",
                  )}
                >
                  <span className="text-sm font-medium text-[#0b0f19]">{row.name}</span>
                  <span className="flex items-center gap-1 text-sm font-semibold text-brand-dark">
                    {row.you && row.rank === 18 ? (
                      <ChevronUp className="size-4 text-emerald-600" />
                    ) : null}
                    #{row.rank}
                  </span>
                </div>
              ))}
              <p className="pt-2 text-center text-xs text-slate-500">
                A score tells you how you did. A rank tells you where you stand.
              </p>
            </div>
          )}

          {step.id === "track" && <LandingDemoStudyProgress />}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="flex items-center justify-center gap-2 text-xs text-slate-600">
            <Trophy className="size-3.5 text-brand" />
            Tap a step above to jump through the flow
          </p>
        </div>
      </div>
    </div>
  );
}
