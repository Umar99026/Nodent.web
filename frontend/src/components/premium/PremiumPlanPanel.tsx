import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/constants";
import { isPremiumUser } from "@/lib/premium";
import {
  formatCompactFreePlanDescription,
  freeAiResponsesRemaining,
  PREMIUM_FEATURE_ROWS,
  type PremiumUsageQuota,
  type PremiumUsageSummary,
} from "@/lib/premiumUsage";
import { usePremiumUsage } from "@/hooks/usePremiumUsage";
import { GetPremiumButton } from "@/components/premium/GetPremiumButton";
import { cn } from "@/lib/utils";
import { Check, Crown, Gauge, Loader2, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";

function compactPlanBlurb(
  usage: PremiumUsageSummary | null,
  loading: boolean,
): string {
  if (loading) return "Loading plan details…";
  const base = formatCompactFreePlanDescription();
  if (!usage) return base;
  const left = freeAiResponsesRemaining(usage);
  if (!Number.isFinite(left)) return base;
  return left > 0
    ? `${base}. ${left} detailed AI response${left === 1 ? "" : "s"} left today.`
    : `${base}. Daily detailed AI responses used — upgrade for unlimited feedback.`;
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

  const planLabel = admin ? "Admin" : premium ? "Pro" : "Free";

  if (compact) {
    return (
      <aside className="practice-card">
        <div className="px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Your plan
              </p>
              <p className="mt-1 font-display text-lg font-bold tracking-tight text-[#0b0f19]">
                {planLabel}
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {premium || admin ? "Full access" : compactPlanBlurb(usage, loading)}
              </p>
            </div>
            {!premium && !admin ? (
              <GetPremiumButton size="sm" className="shrink-0" />
            ) : (
              <span className="shrink-0 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-[#0b0f19]">
                Included
              </span>
            )}
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] bg-[#0b0f19] px-6 py-8 text-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:px-10 sm:py-10">
        <div className="absolute -right-20 -top-24 size-72 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="absolute -bottom-28 left-1/3 size-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                <Gauge className="size-3.5 text-brand-light" aria-hidden />
                Current plan: {planLabel}
              </span>
              {premium || admin ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-light px-3 py-1.5 text-xs font-bold text-[#0b0f19]">
                  <Crown className="size-3.5" aria-hidden />
                  Full access
                </span>
              ) : null}
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Practice without limits.
              <span className="block text-brand-light">Know exactly what to improve.</span>
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base">
              Pro unlocks every practice format, unlimited AI marking, detailed essay feedback,
              past exams, and Ask AI whenever you get stuck.
            </p>
          </div>

          {!premium && !admin ? (
            <div className="w-full shrink-0 lg:w-auto">
              <GetPremiumButton
                label="Upgrade to Pro"
                destination="checkout"
                size="lg"
                variant="accent"
                className="h-12 w-full rounded-xl bg-brand-light px-6 font-semibold text-[#0b0f19] shadow-lg shadow-black/20 hover:bg-white lg:w-auto"
              />
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-white/55 lg:justify-start">
                <ShieldCheck className="size-3.5" aria-hidden />
                Secure checkout powered by Stripe
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-3xl border border-black/8 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-black/[0.04] text-[#0b0f19]">
            <Zap className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-display text-lg font-semibold tracking-tight text-[#0b0f19]">Your usage</p>
            <p className="text-xs text-muted-foreground">Your shared typed-or-drawn AI allowance updates automatically.</p>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading usage…
          </div>
        ) : error ? (
          <p className="mt-5 text-sm text-danger">{error}</p>
        ) : usage && !premium && !admin ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <QuotaMeter label="Detailed AI responses" quota={usage.aiResponses ?? usage.handwritingAiMarks ?? usage.shortAiMarks ?? usage.proseAiMarks} />
            <QuotaMeter label="English essay marking" quota={usage.englishEssays} />
          </div>
        ) : premium || admin ? (
          <div className="mt-5 rounded-2xl border border-brand/20 bg-brand/[0.06] p-4 text-sm font-medium text-brand-deep">
            Unlimited AI marking is active on this account.
          </div>
        ) : (
          <p className="mt-5 text-sm text-muted-foreground">Usage details are unavailable right now.</p>
        )}
      </section>

      <section>
        <div className="mb-4 px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Compare plans</p>
          <h3 className="mt-1 font-display text-2xl font-semibold tracking-tight text-[#0b0f19]">Free vs Pro</h3>
          <p className="mt-1 text-sm text-muted-foreground">Compare every feature before you upgrade.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-2xl font-semibold text-[#0b0f19]">Free</p>
                <p className="mt-1 text-sm text-muted-foreground">Build a daily study habit.</p>
              </div>
              {!premium && !admin ? (
                <span className="rounded-full bg-black/[0.05] px-3 py-1.5 text-xs font-semibold text-[#0b0f19]">Current</span>
              ) : null}
            </div>
            <ul className="mt-6 space-y-3 text-sm text-[#334155]">
              {["Unlimited MCQ practice", "3 detailed typed-or-drawn AI responses each day", "1 English essay mark every 3 days"].map((feature) => (
                <li key={feature} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand-deep" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
          </article>

          <article className="relative overflow-hidden rounded-3xl border border-brand/25 bg-brand/[0.07] p-6 shadow-[0_18px_50px_rgba(35,167,137,0.12)] sm:p-7">
            <Sparkles className="absolute -right-3 -top-3 size-28 text-brand/10" strokeWidth={1} aria-hidden />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display text-2xl font-semibold text-[#0b0f19]">Pro</p>
                  <Crown className="size-5 text-gold-dark" aria-hidden />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">The complete Nodent experience.</p>
              </div>
              <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-white">Best access</span>
            </div>
            <ul className="relative mt-6 space-y-3 text-sm font-medium text-[#1e293b]">
              {["Unlimited AI marking and detailed feedback", "Long answers, drawn working and past exams", "Unlimited English essay marking and Ask AI"].map((feature) => (
                <li key={feature} className="flex gap-3">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Check className="size-2.5" aria-hidden />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            {!premium && !admin ? (
              <GetPremiumButton
                label="Upgrade now"
                destination="checkout"
                size="lg"
                variant="default"
                className="relative mt-7 h-11 w-full rounded-xl bg-[#0b0f19] px-5 text-white hover:bg-[#1e293b]"
              />
            ) : null}
          </article>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-black/8 bg-white shadow-sm">
        <div className="border-b border-black/8 px-5 py-5 sm:px-7">
          <p className="font-display text-lg font-semibold tracking-tight text-[#0b0f19]">Everything at a glance</p>
          <p className="mt-1 text-xs text-muted-foreground">A simple feature-by-feature comparison.</p>
        </div>
        <div className="divide-y divide-black/8">
          {PREMIUM_FEATURE_ROWS.map((row) => (
            <div key={row.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:items-center sm:px-7">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0b0f19]">{row.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p>
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-center">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:hidden">Free</span>
                <PlanCellValue value={row.free} excluded={row.freeExcluded} variant="free" />
              </div>
              <div className="flex items-center justify-between gap-2 sm:justify-center">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-deep sm:hidden">Pro</span>
                <PlanCellValue value={row.premium} variant="premium" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {!premium && !admin ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-black/8 bg-[#f8fafc] px-5 py-5 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <p className="text-sm font-semibold text-[#0b0f19]">Ready to unlock every feature?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">You&apos;ll complete your purchase securely on Stripe.</p>
          </div>
          <GetPremiumButton label="Continue to checkout" destination="checkout" size="default" variant="outline" className="shrink-0" />
        </div>
      ) : null}
    </div>
  );
}
