import { isAdminUser } from "@/lib/constants";

export const PREMIUM_REQUIRED_CODE = "premium_required";

export type PremiumUser = {
  email?: string | null;
  plan?: string | null;
  premiumUntil?: string | null;
  isPremium?: boolean | null;
};

export function isPremiumUser(user: PremiumUser | null | undefined): boolean {
  if (!user) return false;
  if (user.isPremium === true) return true;
  if (isAdminUser(user)) return true;
  const plan = String(user.plan ?? "free").trim().toLowerCase();
  if (plan === "premium" || plan === "paid") {
    const until = String(user.premiumUntil ?? "").trim();
    if (!until) return true;
    const t = Date.parse(until);
    if (!Number.isFinite(t)) return true;
    return t > Date.now();
  }
  return false;
}

export function isPremiumError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? "").toLowerCase();
  return msg.includes("premium") || msg.includes(PREMIUM_REQUIRED_CODE);
}

export const PREMIUM_PATH = "/premium";
