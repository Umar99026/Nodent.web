import { useCallback, useEffect, useState } from "react";
import { fetchPremiumUsage, type PremiumUsageSummary } from "@/lib/premiumUsage";

export const PREMIUM_USAGE_UPDATED_EVENT = "nodent:premium-usage-updated";

export function notifyPremiumUsageUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PREMIUM_USAGE_UPDATED_EVENT));
  }
}

export function usePremiumUsage(enabled = true) {
  const [usage, setUsage] = useState<PremiumUsageSummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPremiumUsage();
      setUsage(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan details.");
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!enabled) return;
    const onUsageUpdated = () => void reload();
    window.addEventListener(PREMIUM_USAGE_UPDATED_EVENT, onUsageUpdated);
    return () => window.removeEventListener(PREMIUM_USAGE_UPDATED_EVENT, onUsageUpdated);
  }, [enabled, reload]);

  return { usage, loading, error, reload };
}
