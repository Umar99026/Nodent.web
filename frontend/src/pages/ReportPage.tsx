import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
import { isAdminUser } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { DashboardReportTable } from "@/components/dashboard/DashboardReportTable";
import type { DashboardScorecard } from "@/lib/dashboardRecommendations";
import { useMySubjects } from "@/hooks/useMySubjects";
import { localDateISO } from "@/lib/utils";
import { toast } from "sonner";

type ReportSubjectRow = NonNullable<DashboardScorecard["reportSubjects"]>[number];

function emptyReportRow(subjectId: string): ReportSubjectRow {
  return {
    subjectId,
    attempts: 0,
    marksCorrect: 0,
    marksAttempted: 0,
    rank: null,
    rankedStudents: 0,
    percentile: null,
    subjectPercent: 0,
    weakestTopic: null,
    strongestTopic: null,
  };
}

export default function ReportPage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const userId = String(user?.id ?? "anonymous");
  const { mySubjects } = useMySubjects(userId, isAdmin);
  const [loading, setLoading] = useState(true);
  const [scoreCard, setScoreCard] = useState<DashboardScorecard | null>(null);
  const lastScorecardToastAtRef = useRef<number>(0);

  const fetchScorecard = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await apiFetch<DashboardScorecard>(
        `/api/scorecard?asOfDate=${encodeURIComponent(localDateISO())}`,
      );
      setScoreCard(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      const now = Date.now();
      if (now - lastScorecardToastAtRef.current < 12_000) return;
      lastScorecardToastAtRef.current = now;
      toast.error(err instanceof Error ? err.message : "Failed to load your report.");
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

  const reportSubjects = useMemo(() => {
    const byId = new Map(
      (scoreCard?.reportSubjects ?? []).map((row) => [row.subjectId, row]),
    );

    if (mySubjects.length > 0) {
      return mySubjects.map((subject) => byId.get(subject.id) ?? emptyReportRow(subject.id));
    }

    return scoreCard?.reportSubjects ?? [];
  }, [mySubjects, scoreCard?.reportSubjects]);

  return (
    <AppShell title="Report" subtitle="Your performance across every subject" compactHeader>
      <DashboardReportTable
        loading={loading}
        overallRank={scoreCard?.overallRank}
        overallPercentile={scoreCard?.overallPercentile}
        reportSubjects={reportSubjects}
      />
    </AppShell>
  );
}
