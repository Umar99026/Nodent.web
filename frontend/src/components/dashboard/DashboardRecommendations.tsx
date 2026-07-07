import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Flame, Target, Zap, type LucideIcon } from "lucide-react";

import type { DashboardAction, DashboardActionTone } from "@/lib/dashboardRecommendations";
import { cn } from "@/lib/utils";

const toneStyles: Record<
  DashboardActionTone,
  {
    icon: LucideIcon;
    iconWrap: string;
    iconColor: string;
    label: string;
    tileClass: string;
    tileHoverClass: string;
    ctaClass: string;
    ctaHoverClass: string;
  }
> = {
  urgent: {
    icon: Zap,
    iconWrap: "bg-brand/12 ring-brand/20",
    iconColor: "text-brand-deep",
    label: "Priority",
    tileClass: "border-brand/25 bg-brand/12",
    tileHoverClass: "hover:border-brand/40 hover:shadow-md",
    ctaClass: "border-brand/30 bg-white text-brand-deep",
    ctaHoverClass: "group-hover:border-brand group-hover:bg-brand group-hover:text-white",
  },
  focus: {
    icon: Target,
    iconWrap: "bg-sky-100 ring-sky-200",
    iconColor: "text-sky-900",
    label: "Focus",
    tileClass: "border-sky-200 bg-sky-50",
    tileHoverClass: "hover:border-sky-300 hover:shadow-md",
    ctaClass: "border-sky-200 bg-white text-sky-900",
    ctaHoverClass: "group-hover:border-sky-700 group-hover:bg-sky-700 group-hover:text-white",
  },
  steady: {
    icon: BookOpen,
    iconWrap: "bg-emerald-100 ring-emerald-200",
    iconColor: "text-emerald-900",
    label: "Practice",
    tileClass: "border-emerald-200 bg-emerald-50",
    tileHoverClass: "hover:border-emerald-300 hover:shadow-md",
    ctaClass: "border-emerald-200 bg-white text-emerald-900",
    ctaHoverClass: "group-hover:border-emerald-700 group-hover:bg-emerald-700 group-hover:text-white",
  },
  celebrate: {
    icon: Flame,
    iconWrap: "bg-gold/12 ring-gold/25",
    iconColor: "text-gold-dark",
    label: "Streak",
    tileClass: "border-gold/30 bg-gold/15",
    tileHoverClass: "hover:border-gold/45 hover:shadow-md",
    ctaClass: "border-gold/35 bg-white text-gold-dark",
    ctaHoverClass: "group-hover:border-gold-dark group-hover:bg-gold-dark group-hover:text-white",
  },
};

type DashboardRecommendationsProps = {
  actions: DashboardAction[];
  loading?: boolean;
};

export function DashboardRecommendations({ actions, loading }: DashboardRecommendationsProps) {
  const navigate = useNavigate();

  const sectionIntro = (
    <p className="mb-4 text-sm text-muted-foreground">
      Based on your topics, confidence, and recent performance
    </p>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {sectionIntro}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[5.5rem] animate-pulse items-center gap-4 overflow-hidden rounded-2xl border border-brand/20 bg-brand/10 p-4 sm:p-5"
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
      <div className="space-y-3">
        {sectionIntro}
        <div className="rounded-2xl border border-dashed border-black/12 bg-[#f3f4f6]/40 px-6 py-10 text-center">
          <p className="text-lg font-semibold text-[#0b0f19]">Your plan will appear here</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Add subjects and complete a few questions to unlock personalised next steps.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sectionIntro}

      {actions.map((action) => {
        const style = toneStyles[action.tone];
        const Icon = style.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => navigate(action.href)}
            className={cn(
              "group flex w-full items-center gap-4 overflow-hidden rounded-2xl border text-left shadow-sm transition-all sm:gap-5",
              style.tileClass,
              style.tileHoverClass,
            )}
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
                <p className="mt-1 text-base font-semibold leading-snug text-[#0b0f19] sm:text-lg">
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
                    "flex size-9 items-center justify-center rounded-full border transition-colors",
                    style.ctaClass,
                    style.ctaHoverClass,
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
