import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardReportTable } from "@/components/dashboard/DashboardReportTable";
import type { DashboardScorecard } from "@/lib/dashboardRecommendations";
import { localDateISO } from "@/lib/utils";
import { toast } from "sonner";

export default function ReportPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scoreCard, setScoreCard] = useState<DashboardScorecard | null>(null);

  const fetchScorecard = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await apiFetch<DashboardScorecard>(
        `/api/scorecard?asOfDate=${encodeURIComponent(localDateISO())}`,
      );
      setScoreCard(data);
    } catch {
      toast.error("Failed to load your report.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchScorecard();
  }, [user, fetchScorecard]);

  useEffect(() => {
    const onScorecardUpdated = () => {
      void fetchScorecard();
    };
    window.addEventListener("nodent:scorecard-updated", onScorecardUpdated);
    return () => window.removeEventListener("nodent:scorecard-updated", onScorecardUpdated);
  }, [fetchScorecard]);

  return (
    <AppShell title="Report" subtitle="Your performance across every subject">
      <DashboardReportTable
        loading={loading}
        overallRank={scoreCard?.overallRank}
        overallPercentile={scoreCard?.overallPercentile}
        reportSubjects={scoreCard?.reportSubjects}
      />
    </AppShell>
  );
}
