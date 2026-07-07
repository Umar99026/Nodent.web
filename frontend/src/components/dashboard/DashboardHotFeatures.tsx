import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { canAccessTrackNav } from "@/lib/constants";
import { PremiumPlanPanel } from "@/components/premium/PremiumPlanPanel";
import { cn } from "@/lib/utils";
import { ArrowRight, Flame } from "lucide-react";

type HotFeature = {
  id: string;
  label: string;
  description: string;
  onClick: () => void;
};

export function DashboardHotFeatures() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features: HotFeature[] = [
    {
      id: "essay-marking",
      label: "Essay marking",
      description: "Upload writing and get feedback",
      onClick: () => navigate("/quiz/english"),
    },
  ];

  if (canAccessTrackNav(user)) {
    features.push({
      id: "track-study",
      label: "Track my study",
      description: "Log minutes and study streaks",
      onClick: () => navigate("/track"),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PremiumPlanPanel compact />
      <aside className="practice-card">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                What&apos;s hot
              </p>
              <p className="mt-1 font-display text-lg font-bold tracking-tight text-[#0b0f19]">
                What&apos;s hot
              </p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-dark">
              <Flame className="size-4" aria-hidden />
            </span>
          </div>
        </div>

        <div className="divide-y divide-black/8">
        {features.map((feature) => (
          <button
            key={feature.id}
            type="button"
            onClick={feature.onClick}
            className={cn(
              "group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors sm:px-5 sm:py-4",
              "hover:bg-black/[0.035]",
            )}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0b0f19]">{feature.label}</p>
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                {feature.description}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-[#0b0f19]" />
          </button>
        ))}
      </div>
      </aside>
    </div>
  );
}
