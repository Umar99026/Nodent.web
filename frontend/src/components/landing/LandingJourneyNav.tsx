import { ArrowRight } from "lucide-react";
import { LANDING_DEMO_STEPS } from "@/components/landing/landingDemoSteps";
import { cn } from "@/lib/utils";

type LandingJourneyNavProps = {
  activeIndex: number;
  onSelect: (index: number) => void;
};

export function LandingJourneyNav({ activeIndex, onSelect }: LandingJourneyNavProps) {
  return (
    <div
      className="flex flex-wrap items-center justify-start gap-2 sm:gap-3"
      role="tablist"
      aria-label="Product journey"
    >
      {LANDING_DEMO_STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            role="tab"
            aria-selected={activeIndex === i}
            aria-controls="demo-animation-panel"
            onClick={() => onSelect(i)}
            className={cn(
              "min-h-11 rounded-full border px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:py-2.5 sm:text-sm",
              activeIndex === i
                ? "border-brand bg-brand/10 text-brand-dark ring-2 ring-brand/25"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand/30 hover:bg-brand/5",
            )}
          >
            {step.label}
          </button>
          {i < LANDING_DEMO_STEPS.length - 1 ? (
            <ArrowRight className="hidden size-4 shrink-0 text-slate-300 sm:block" aria-hidden />
          ) : null}
        </div>
      ))}
    </div>
  );
}
