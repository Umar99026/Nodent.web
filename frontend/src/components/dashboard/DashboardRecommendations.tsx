import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Flame, Target, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { greetingNameSeparator } from "@/lib/dashboardGreeting";
import type { DashboardAction, DashboardActionTone } from "@/lib/dashboardRecommendations";

const toneStyles: Record<
  DashboardActionTone,
  { icon: LucideIcon; iconWrap: string; iconColor: string; label: string }
> = {
  urgent: {
    icon: Zap,
    iconWrap: "bg-brand/12 ring-brand/20",
    iconColor: "text-brand-deep",
    label: "Priority",
  },
  focus: {
    icon: Target,
    iconWrap: "bg-[#0b0f19]/6 ring-black/8",
    iconColor: "text-[#0b0f19]",
    label: "Focus",
  },
  steady: {
    icon: BookOpen,
    iconWrap: "bg-brand-light/40 ring-brand/15",
    iconColor: "text-brand-dark",
    label: "Practice",
  },
  celebrate: {
    icon: Flame,
    iconWrap: "bg-gold/12 ring-gold/25",
    iconColor: "text-gold-dark",
    label: "Streak",
  },
};

type DashboardRecommendationsProps = {
  actions: DashboardAction[];
  loading?: boolean;
  greeting?: string;
};

export function DashboardRecommendations({
  actions,
  loading,
  greeting,
}: DashboardRecommendationsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[5.5rem] animate-pulse items-center gap-4 overflow-hidden rounded-2xl border border-black/8 bg-white p-4 sm:p-5"
          >
            <div className="size-11 shrink-0 rounded-xl bg-black/8" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-16 rounded bg-black/8" />
              <div className="h-4 w-3/4 rounded bg-black/10" />
              <div className="h-3 w-full rounded bg-black/6" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!actions.length) {
    return (
      <div className="rounded-2xl border border-dashed border-black/12 bg-[#f3f4f6]/40 px-6 py-10 text-center">
        <p className="font-display text-lg font-semibold text-[#0b0f19]">
          Your plan will appear here
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Add subjects and complete a few questions to unlock personalised next steps.
        </p>
      </div>
    );
  }

  const welcomeLead = greeting?.trim() ? greeting.trim() : "Hey!";

  return (
    <div className="space-y-3">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold tracking-tight text-[#0b0f19] sm:text-2xl">
          <span className="font-medium text-[#64748b]">
            {welcomeLead}
            {greetingNameSeparator(welcomeLead)}
          </span>{" "}
          here&apos;s your plan
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on your topics, confidence, and recent performance
        </p>
      </div>

      {actions.map((action) => {
        const style = toneStyles[action.tone];
        const Icon = style.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => navigate(action.href)}
            className="group flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-black/8 bg-white text-left shadow-sm transition-all hover:border-black/14 hover:shadow-md sm:gap-5"
          >
            <div className="flex min-w-0 flex-1 items-center gap-4 p-4 sm:gap-5 sm:p-5">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
                  style.iconWrap,
                )}
                aria-hidden
              >
                <Icon className={cn("size-5", style.iconColor)} strokeWidth={2.25} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {style.label}
                </p>
                <p className="mt-1 font-display text-base font-semibold leading-snug text-[#0b0f19] sm:text-lg">
                  {action.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {action.subtitle}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                <span className="hidden text-sm font-medium text-[#0b0f19] sm:inline">
                  {action.cta}
                </span>
                <span
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border border-black/10 bg-[#f3f4f6] text-[#0b0f19]",
                    "transition-colors group-hover:border-[#0b0f19] group-hover:bg-[#0b0f19] group-hover:text-white",
                  )}
                  aria-hidden
                >
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
