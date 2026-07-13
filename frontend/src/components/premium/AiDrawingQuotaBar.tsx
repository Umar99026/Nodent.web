import { PenLine } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePremiumUsage } from "@/hooks/usePremiumUsage";
import {
  FREE_DAILY_DRAWING_AI_LIMIT,
  freeDrawingAiRemaining,
} from "@/lib/premiumUsage";
import { isPremiumUser } from "@/lib/premium";
import { cn } from "@/lib/utils";

export function AiDrawingQuotaBar({ className }: { className?: string }) {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const { usage, loading } = usePremiumUsage(Boolean(user) && !premium);

  if (!user || premium) return null;

  const remaining = freeDrawingAiRemaining(usage);
  const percent = Math.max(
    0,
    Math.min(100, (remaining / FREE_DAILY_DRAWING_AI_LIMIT) * 100),
  );

  return (
    <aside
      data-ai-drawing-quota="true"
      className={cn(
        "rounded-2xl border border-brand/15 bg-brand/[0.045] px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PenLine className="size-4 text-brand-deep" aria-hidden />
          Free AI drawing marks
        </div>
        <span className="text-xs font-semibold tabular-nums text-brand-deep">
          {loading
            ? "Checking…"
            : `${remaining} of ${FREE_DAILY_DRAWING_AI_LIMIT} left today`}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-black/10"
        role="progressbar"
        aria-label="AI drawing marks remaining today"
        aria-valuemin={0}
        aria-valuemax={FREE_DAILY_DRAWING_AI_LIMIT}
        aria-valuenow={loading ? undefined : remaining}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Drawing an answer uses one mark. Typed answers use unlimited instant matching.
      </p>
    </aside>
  );
}
