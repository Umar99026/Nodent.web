import { useCallback, useEffect, useState } from "react";
import { fetchPremiumUsage, type PremiumUsageSummary } from "@/lib/premiumUsage";

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

  return { usage, loading, error, reload };
}
