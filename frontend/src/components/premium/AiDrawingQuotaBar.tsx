import { Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePremiumUsage } from "@/hooks/usePremiumUsage";
import {
  FREE_DAILY_AI_RESPONSE_LIMIT,
  freeAiResponsesRemaining,
} from "@/lib/premiumUsage";
import { isPremiumUser } from "@/lib/premium";
import { cn } from "@/lib/utils";

export function AiResponseQuotaBar({ className }: { className?: string }) {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const { usage, loading } = usePremiumUsage(Boolean(user) && !premium);

  if (!user || premium) return null;

  const remaining = freeAiResponsesRemaining(usage);
  const percent = Math.max(
    0,
    Math.min(100, (remaining / FREE_DAILY_AI_RESPONSE_LIMIT) * 100),
  );

  return (
    <aside
      data-ai-response-quota="true"
      className={cn(
        "rounded-2xl border border-brand/15 bg-brand/[0.045] px-4 py-3 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="size-4 text-brand-deep" aria-hidden />
          Free detailed AI responses
        </div>
        <span className="text-xs font-semibold tabular-nums text-brand-deep">
          {loading
            ? "Checking…"
            : `${remaining} of ${FREE_DAILY_AI_RESPONSE_LIMIT} left today`}
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-black/10"
        role="progressbar"
        aria-label="Detailed AI responses remaining today"
        aria-valuemin={0}
        aria-valuemax={FREE_DAILY_AI_RESPONSE_LIMIT}
        aria-valuenow={loading ? undefined : remaining}
      >
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        Typed and drawn answers each use one response. Upgrade to Pro for unlimited feedback.
      </p>
    </aside>
  );
}
