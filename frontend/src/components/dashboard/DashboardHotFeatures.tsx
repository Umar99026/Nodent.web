import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { canAccessTrackNav } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

type HotFeature = {
  id: string;
  label: string;
  description: string;
  onClick: () => void;
};

type DashboardHotFeaturesProps = {
  onOpenStats: () => void;
};

export function DashboardHotFeatures({ onOpenStats }: DashboardHotFeaturesProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const features: HotFeature[] = [
    {
      id: "essay-marking",
      label: "Essay marking",
      description: "Upload writing and get feedback",
      onClick: () => navigate("/quiz/english"),
    },
    {
      id: "view-stats",
      label: "View stats",
      description: "Report card and subject breakdowns",
      onClick: onOpenStats,
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
    <aside className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
      <div className="practice-card-header !min-h-0 !py-3.5 sm:!py-4">
        <p className="practice-card-header-title">Shortcuts</p>
        <p className="practice-card-header-meta">Popular tools</p>
      </div>

      <div className="divide-y divide-black/8">
        {features.map((feature) => (
          <button
            key={feature.id}
            type="button"
            onClick={feature.onClick}
            className={cn(
              "group flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors sm:px-5 sm:py-4",
              "hover:bg-[#f3f4f6]/70",
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
  );
}
