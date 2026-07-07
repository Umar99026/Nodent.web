import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/constants";
import { isPremiumUser } from "@/lib/premium";
import {
  formatFreePlanSummary,
  PREMIUM_FEATURE_ROWS,
  type PremiumUsageQuota,
  type PremiumUsageSummary,
} from "@/lib/premiumUsage";
import { usePremiumUsage } from "@/hooks/usePremiumUsage";
import { GetPremiumButton } from "@/components/premium/GetPremiumButton";
import { cn } from "@/lib/utils";
import { Check, Loader2, Lock } from "lucide-react";

function compactPlanBlurb(
  usage: PremiumUsageSummary | null,
  loading: boolean,
): string {
  if (loading) return "Loading usage…";
  if (!usage) return "Limited daily AI marking";
  const prose = usage.proseAiMarks;
  if (prose.limit != null) {
    const left = Math.max(0, prose.limit - prose.used);
    return left > 0
      ? `${left} long-answer mark${left === 1 ? "" : "s"} left today`
      : "Daily AI marking used up";
  }
  return "Limited daily AI marking";
}

function QuotaMeter({
  label,
  quota,
}: {
  label: string;
  quota: PremiumUsageQuota;
}) {
  const limit = quota.limit;
  const used = quota.used;
  const unlimited = limit == null;
  const remaining = unlimited || !limit ? null : Math.max(0, limit - used);
  const pct =
    unlimited || !limit ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const atLimit = !unlimited && limit != null && used >= limit;

  return (
    <div className="rounded-2xl border border-black/8 bg-[#f8fafc] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0b0f19]">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {quota.windowDays === 1 ? "Resets daily" : `Resets every ${quota.windowDays} days`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-[#0b0f19]">
            {unlimited ? (
              <span className="text-brand-deep">Unlimited</span>
            ) : (
              <>
                {used} / {limit}
              </>
            )}
          </p>
          {!unlimited && remaining != null ? (
            <p className={cn("mt-0.5 text-xs", atLimit ? "text-gold-dark" : "text-muted-foreground")}>
              {atLimit ? "Limit reached" : `${remaining} left`}
            </p>
          ) : null}
        </div>
      </div>
      {!unlimited && limit ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/8">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              atLimit ? "bg-gold-dark" : "bg-brand",
            )}
            style={{ width: `${Math.max(pct, used > 0 ? 8 : 0)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function PlanCellValue({
  value,
  excluded,
  variant,
}: {
  value: string;
  excluded?: boolean;
  variant: "free" | "premium";
}) {
  if (excluded) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground">
        <Lock className="size-3 shrink-0" aria-hidden />
        Not included
      </span>
    );
  }

  if (variant === "premium") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/25 bg-white px-2.5 py-1 text-xs font-semibold text-brand-deep">
        <Check className="size-3 shrink-0" aria-hidden />
        {value}
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-semibold text-[#0b0f19]">
      {value}
    </span>
  );
}

type PremiumPlanPanelProps = {
  compact?: boolean;
};

export function PremiumPlanPanel({ compact = false }: PremiumPlanPanelProps) {
  const { user } = useAuth();
  const premium = isPremiumUser(user);
  const admin = isAdminUser(user);
  const { usage, loading, error } = usePremiumUsage(!!user);

  const planLabel = admin ? "Admin" : premium ? "Premium" : "Free";

  if (compact) {
    return (
      <aside className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
        <div className="practice-card-header !min-h-0 !py-3.5 sm:!py-4">
          <p className="practice-card-header-title">Your plan</p>
          <p className="practice-card-header-meta">{planLabel}</p>
        </div>
        {!premium && !admin ? (
          <div className="flex items-center justify-between gap-3 border-t border-black/8 px-4 py-3 sm:px-5">
            <p className="text-xs leading-snug text-muted-foreground">
              {compactPlanBlurb(usage, loading)}
            </p>
            <GetPremiumButton size="sm" className="shrink-0" />
          </div>
        ) : null}
      </aside>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/8 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Your plan
            </p>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[#0b0f19] sm:text-3xl">
              {planLabel}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {admin
                ? "Admin accounts have full access. Below is what free and Premium students see."
                : premium
                  ? "You have unlimited long-answer AI marking, drawn working-out marking, and English feedback."
                  : formatFreePlanSummary(usage)}
            </p>
          </div>
          {!premium && !admin ? (
            <GetPremiumButton size="default" className="shrink-0" />
          ) : null}
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading usage…
          </div>
        ) : error ? (
          <p className="mt-6 text-sm text-danger">{error}</p>
        ) : usage && !premium && !admin ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <QuotaMeter label="Long-answer AI marking" quota={usage.proseAiMarks} />
            <QuotaMeter label="English essay marking" quota={usage.englishEssays} />
            <QuotaMeter label="Drawn working-out marking" quota={usage.handwritingAiMarks} />
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
        <div className="practice-card-header !min-h-0 !py-3.5 sm:!py-4">
          <p className="practice-card-header-title">Free vs Premium</p>
          <p className="practice-card-header-meta">What&apos;s included</p>
        </div>

        <div className="hidden border-b border-black/8 sm:grid sm:grid-cols-[minmax(0,1.35fr)_7.5rem_7.5rem]">
          <div className="px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Feature
          </div>
          <div className="border-l border-black/8 bg-[#f8fafc] px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Free
          </div>
          <div className="border-l border-black/8 bg-brand/8 px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-brand-deep">
            Premium
          </div>
        </div>

        <div className="divide-y divide-black/8">
          {PREMIUM_FEATURE_ROWS.map((row) => (
            <div
              key={row.id}
              className="sm:grid sm:grid-cols-[minmax(0,1.35fr)_7.5rem_7.5rem]"
            >
              <div className="min-w-0 px-4 py-4 sm:px-6 sm:py-5">
                <p className="text-sm font-semibold text-[#0b0f19]">{row.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {row.description}
                </p>
              </div>

              <div className="flex items-center gap-2 border-t border-black/8 bg-[#f8fafc]/80 px-4 py-3 sm:justify-center sm:border-t-0 sm:border-l sm:px-3 sm:py-5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">
                  Free
                </span>
                <PlanCellValue value={row.free} excluded={row.freeExcluded} variant="free" />
              </div>

              <div className="flex items-center gap-2 border-t border-black/8 bg-brand/5 px-4 py-3 sm:justify-center sm:border-t-0 sm:border-l sm:px-3 sm:py-5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-deep sm:hidden">
                  Premium
                </span>
                <PlanCellValue value={row.premium} variant="premium" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {!premium && !admin ? (
        <p className="text-center text-sm text-muted-foreground">
          Payments coming soon — contact us if you need Premium access early.
        </p>
      ) : null}
    </div>
  );
}
