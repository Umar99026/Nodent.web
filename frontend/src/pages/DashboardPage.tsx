import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { isAdminUser } from "@/lib/constants";
import { getDashboardGreeting } from "@/lib/dashboardGreeting";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { localDateISO } from "@/lib/utils";
import { useMySubjects } from "@/hooks/useMySubjects";
import { DashboardRecommendations } from "@/components/dashboard/DashboardRecommendations";
import { DashboardPlanGreeting } from "@/components/dashboard/DashboardPlanGreeting";
import { DashboardSubjectRail } from "@/components/dashboard/DashboardSubjectRail";
import { DashboardHotFeatures } from "@/components/dashboard/DashboardHotFeatures";
import {
  buildDashboardActions,
  type DashboardScorecard,
} from "@/lib/dashboardRecommendations";

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const userId = String(user?.id ?? "anonymous");
  const initials = user?.username
    ? user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const {
    mySubjects,
    confidenceRanks,
    loading: subjectsLoading,
    addSubject,
    removeSubject,
  } = useMySubjects(userId, isAdmin);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [scoreCardLoading, setScoreCardLoading] = useState(true);
  const [scoreCard, setScoreCard] = useState<DashboardScorecard | null>(null);

  const fetchScorecard = useCallback(async () => {
    if (!user) return;
    try {
      setScoreCardLoading(true);
      const data = await apiFetch<DashboardScorecard>(
        `/api/scorecard?asOfDate=${encodeURIComponent(localDateISO())}`,
      );
      setScoreCard(data);
    } catch {
      toast.error("Failed to load your report card.");
    } finally {
      setScoreCardLoading(false);
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

  useEffect(() => {
    if (!selectedSubjectId && mySubjects[0]) {
      setSelectedSubjectId(mySubjects[0].id);
    }
  }, [mySubjects, selectedSubjectId]);

  const actions = useMemo(
    () =>
      buildDashboardActions({
        subjects: mySubjects,
        scorecard: scoreCard,
        confidenceRanks,
      }),
    [mySubjects, scoreCard, confidenceRanks],
  );

  const greeting = useMemo(
    () => (user?.id != null ? getDashboardGreeting(user.id) : "Hey!"),
    [user?.id],
  );
  const displayName = user?.username ?? "Student";

  return (
    <AppShell
      title=""
      hideTitle
      subtitle={<DashboardPlanGreeting greeting={greeting} displayName={displayName} />}
      subtitleClassName="max-w-none overflow-visible text-left font-sans"
      headerRight={
        <div
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-[#0b0f19] shadow-[0_10px_30px_rgba(0,0,0,0.14)] ${
            user?.profilePhoto ? "bg-transparent" : "bg-white"
          }`}
        >
          <Avatar
            className={`shrink-0 after:border-transparent ${
              user?.profilePhoto ? "size-12" : "size-8"
            }`}
          >
            <AvatarImage src={user?.profilePhoto ?? undefined} alt={user?.username ?? "User"} />
            <AvatarFallback className="bg-[#f4f7fb] text-xs font-bold text-[#0b0f19]">
              {user?.profilePhoto ? initials : <Star className="size-4 text-[#0b0f19]" />}
            </AvatarFallback>
          </Avatar>
        </div>
      }
    >
      <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <section className="min-w-0 rounded-3xl border border-black/8 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <DashboardRecommendations
            actions={actions}
            loading={scoreCardLoading || subjectsLoading}
          />
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <DashboardSubjectRail
            subjects={mySubjects}
            confidenceRanks={confidenceRanks}
            selectedSubjectId={selectedSubjectId}
            onSelectSubject={setSelectedSubjectId}
            onAddSubject={addSubject}
            onRemoveSubject={removeSubject}
            isAdmin={isAdmin}
          />

          <DashboardHotFeatures />
        </div>
      </div>
    </AppShell>
  );
}
