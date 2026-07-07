import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Flame, Target, Zap, type LucideIcon } from "lucide-react";

import type { DashboardAction, DashboardActionTone } from "@/lib/dashboardRecommendations";
import { cn } from "@/lib/utils";

type TilePalette = {
  tileClass: string;
  tileHoverClass: string;
  iconWrap: string;
  iconColor: string;
  ctaClass: string;
  ctaHoverClass: string;
};

const tilePalettes: TilePalette[] = [
  {
    tileClass: "border-[#56abe6]/35 bg-[#56abe6]/12",
    tileHoverClass: "hover:border-[#56abe6]/55 hover:shadow-md",
    iconWrap: "bg-[#56abe6]/18 ring-[#56abe6]/30",
    iconColor: "text-[#1a6fa8]",
    ctaClass: "border-[#56abe6]/40 bg-white text-[#1a6fa8]",
    ctaHoverClass: "group-hover:border-[#56abe6] group-hover:bg-[#56abe6] group-hover:text-white",
  },
  {
    tileClass: "border-violet-200 bg-violet-50",
    tileHoverClass: "hover:border-violet-300 hover:shadow-md",
    iconWrap: "bg-violet-100 ring-violet-200",
    iconColor: "text-violet-800",
    ctaClass: "border-violet-200 bg-white text-violet-800",
    ctaHoverClass: "group-hover:border-violet-700 group-hover:bg-violet-700 group-hover:text-white",
  },
  {
    tileClass: "border-amber-200 bg-amber-50",
    tileHoverClass: "hover:border-amber-300 hover:shadow-md",
    iconWrap: "bg-amber-100 ring-amber-200",
    iconColor: "text-amber-900",
    ctaClass: "border-amber-200 bg-white text-amber-900",
    ctaHoverClass: "group-hover:border-amber-700 group-hover:bg-amber-700 group-hover:text-white",
  },
  {
    tileClass: "border-rose-200 bg-rose-50",
    tileHoverClass: "hover:border-rose-300 hover:shadow-md",
    iconWrap: "bg-rose-100 ring-rose-200",
    iconColor: "text-rose-800",
    ctaClass: "border-rose-200 bg-white text-rose-800",
    ctaHoverClass: "group-hover:border-rose-700 group-hover:bg-rose-700 group-hover:text-white",
  },
  {
    tileClass: "border-emerald-200 bg-emerald-50",
    tileHoverClass: "hover:border-emerald-300 hover:shadow-md",
    iconWrap: "bg-emerald-100 ring-emerald-200",
    iconColor: "text-emerald-900",
    ctaClass: "border-emerald-200 bg-white text-emerald-900",
    ctaHoverClass: "group-hover:border-emerald-700 group-hover:bg-emerald-700 group-hover:text-white",
  },
  {
    tileClass: "border-orange-200 bg-orange-50",
    tileHoverClass: "hover:border-orange-300 hover:shadow-md",
    iconWrap: "bg-orange-100 ring-orange-200",
    iconColor: "text-orange-900",
    ctaClass: "border-orange-200 bg-white text-orange-900",
    ctaHoverClass: "group-hover:border-orange-700 group-hover:bg-orange-700 group-hover:text-white",
  },
  {
    tileClass: "border-teal-200 bg-teal-50",
    tileHoverClass: "hover:border-teal-300 hover:shadow-md",
    iconWrap: "bg-teal-100 ring-teal-200",
    iconColor: "text-teal-900",
    ctaClass: "border-teal-200 bg-white text-teal-900",
    ctaHoverClass: "group-hover:border-teal-700 group-hover:bg-teal-700 group-hover:text-white",
  },
  {
    tileClass: "border-fuchsia-200 bg-fuchsia-50",
    tileHoverClass: "hover:border-fuchsia-300 hover:shadow-md",
    iconWrap: "bg-fuchsia-100 ring-fuchsia-200",
    iconColor: "text-fuchsia-900",
    ctaClass: "border-fuchsia-200 bg-white text-fuchsia-900",
    ctaHoverClass: "group-hover:border-fuchsia-700 group-hover:bg-fuchsia-700 group-hover:text-white",
  },
];

const toneMeta: Record<
  DashboardActionTone,
  {
    icon: LucideIcon;
    label: string;
    /** Pin urgent/celebrate tiles to a fixed palette so they still read clearly. */
    paletteIndex?: number;
  }
> = {
  urgent: {
    icon: Zap,
    label: "Priority",
    paletteIndex: 3,
  },
  focus: {
    icon: Target,
    label: "Focus",
    paletteIndex: 1,
  },
  steady: {
    icon: BookOpen,
    label: "Practice",
  },
  celebrate: {
    icon: Flame,
    label: "Streak",
    paletteIndex: 2,
  },
};

function paletteForAction(action: DashboardAction, index: number): TilePalette {
  const meta = toneMeta[action.tone];
  const paletteIndex =
    meta.paletteIndex != null ? meta.paletteIndex : index % tilePalettes.length;
  return tilePalettes[paletteIndex]!;
}

type DashboardRecommendationsProps = {
  actions: DashboardAction[];
  loading?: boolean;
  onActionOpen?: (action: DashboardAction) => void;
};

export function DashboardRecommendations({
  actions,
  loading,
  onActionOpen,
}: DashboardRecommendationsProps) {
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
            className={cn(
              "flex h-[5.5rem] animate-pulse items-center gap-4 overflow-hidden rounded-2xl border p-4 sm:p-5",
              tilePalettes[i % tilePalettes.length]!.tileClass,
            )}
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

      {actions.map((action, index) => {
        const meta = toneMeta[action.tone];
        const palette = paletteForAction(action, index);
        const Icon = meta.icon;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => {
              onActionOpen?.(action);
              navigate(action.href);
            }}
            className={cn(
              "group flex w-full items-center gap-4 overflow-hidden rounded-2xl border text-left shadow-sm transition-all sm:gap-5",
              palette.tileClass,
              palette.tileHoverClass,
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-4 p-4 sm:gap-5 sm:p-5">
              <div
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
                  palette.iconWrap,
                )}
                aria-hidden
              >
                <Icon className={cn("size-5", palette.iconColor)} strokeWidth={2.25} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {meta.label}
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
                    palette.ctaClass,
                    palette.ctaHoverClass,
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
