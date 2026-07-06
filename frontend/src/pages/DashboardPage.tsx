import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS, isAdminUser } from "@/lib/constants";
import { getDashboardGreeting, greetingNameSeparator } from "@/lib/dashboardGreeting";
import { AppShell } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Star, X } from "lucide-react";
import { localDateISO } from "@/lib/utils";
import { useMySubjects } from "@/hooks/useMySubjects";
import { DashboardRecommendations } from "@/components/dashboard/DashboardRecommendations";
import { DashboardSubjectRail } from "@/components/dashboard/DashboardSubjectRail";
import { DashboardHotFeatures } from "@/components/dashboard/DashboardHotFeatures";
import {
  buildDashboardActions,
  type DashboardScorecard,
} from "@/lib/dashboardRecommendations";
import { baseSubjects } from "@/lib/subjects";
import { displayTopicLabel } from "@/lib/topicDisplay";

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
  const [scoreCardOpen, setScoreCardOpen] = useState(false);
  const [scoreCardLoading, setScoreCardLoading] = useState(false);
  const [scoreCard, setScoreCard] = useState<DashboardScorecard | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const avgDailyStudyMinutes = useMemo(() => {
    if (!user) return 0;
    const uid = String(user.id);
    const today = new Date();
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = `${STORAGE_KEYS.studyPrefix}${uid}_${localDateISO(d)}`;
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        total += (typeof parsed?.dailySeconds === "number" ? parsed.dailySeconds : 0) / 60;
      } catch {
        /* ignore */
      }
    }
    return Math.round(total / 7);
  }, [user]);

  const fetchScorecard = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return;
    try {
      if (!opts?.silent) setScoreCardLoading(true);
      const data = await apiFetch<DashboardScorecard>(
        `/api/scorecard?asOfDate=${encodeURIComponent(localDateISO())}`,
      );
      setScoreCard(data);
    } catch {
      if (!opts?.silent) toast.error("Failed to load your report card.");
    } finally {
      if (!opts?.silent) setScoreCardLoading(false);
      setPlanLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void fetchScorecard({ silent: true });
  }, [user, fetchScorecard]);

  useEffect(() => {
    if (scoreCardOpen && !scoreCard && user) {
      void fetchScorecard();
    }
  }, [scoreCardOpen, scoreCard, user, fetchScorecard]);

  useEffect(() => {
    const onScorecardUpdated = () => {
      if (!scoreCardOpen) {
        setScoreCard(null);
        setPlanLoading(true);
        void fetchScorecard({ silent: true });
        return;
      }
      void fetchScorecard({ silent: true });
    };
    window.addEventListener("nodent:scorecard-updated", onScorecardUpdated);
    return () => window.removeEventListener("nodent:scorecard-updated", onScorecardUpdated);
  }, [scoreCardOpen, fetchScorecard]);

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
      subtitle={
        <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 font-display leading-[1.15] sm:gap-x-3.5">
          <span className="text-[1.125rem] font-medium tracking-tight text-[#64748b] sm:text-xl">
            {greeting}
            {greetingNameSeparator(greeting)}
          </span>
          <span className="text-[clamp(1.65rem,4.5vw,2.5rem)] font-bold tracking-tight text-[#0b0f19]">
            {displayName}
          </span>
        </h1>
      }
      hideTitle
      subtitleClassName="max-w-none text-left !text-[#0b0f19]"
      headerRight={
        <button
          type="button"
          onClick={() => setScoreCardOpen((v) => !v)}
          className={`inline-flex h-12 w-12 items-center justify-center rounded-full text-[#0b0f19] shadow-[0_10px_30px_rgba(0,0,0,0.14)] transition-colors ${
            user?.profilePhoto ? "bg-transparent hover:opacity-92" : "bg-white hover:bg-white/92"
          }`}
          aria-label="Open scorecard"
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
        </button>
      }
    >
      {scoreCardOpen ? (
        <div className="fixed inset-0 z-[300]">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setScoreCardOpen(false)}
          />
          <div className="absolute inset-0 overflow-auto p-4 sm:p-8">
            <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/8 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-[#0b0f19] sm:text-3xl">
                    Report Card
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Live summary based on your marks and performance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScoreCardOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/[0.04]"
                  aria-label="Close scorecard"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mb-6 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: "Overall percentile",
                    value:
                      scoreCard?.overallPercentile != null
                        ? `${Math.round(scoreCard.overallPercentile)}%`
                        : "—",
                  },
                  {
                    label: "Avg daily study (7d)",
                    value: `${avgDailyStudyMinutes} min`,
                  },
                  {
                    label: "Study streak",
                    value: `${scoreCard?.studyStreak ?? 0} days`,
                  },
                ].map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-2xl border border-black/20 bg-[#0b0f19] p-4 text-white"
                  >
                    <p className="text-xs uppercase tracking-wide text-white/60">{tile.label}</p>
                    <p className="mt-2 font-display text-2xl font-bold">
                      {scoreCardLoading ? "…" : tile.value}
                    </p>
                  </div>
                ))}
              </div>

              {scoreCard?.reportSubjects?.length ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {scoreCard.reportSubjects.map((row) => {
                    const subjectName =
                      baseSubjects.find((s) => s.id === row.subjectId)?.name ?? row.subjectId;
                    return (
                      <Card key={row.subjectId} className="border-black/10">
                        <CardContent className="p-4">
                          <p className="font-display font-semibold text-[#0b0f19]">{subjectName}</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {row.percentile != null
                              ? `${Math.round(row.percentile)}th percentile`
                              : `${row.attempts} attempts`}
                          </p>
                          {row.weakestTopic ? (
                            <p className="mt-2 text-sm">
                              Weakest: {displayTopicLabel(row.weakestTopic.topic)} ({row.weakestTopic.percent}%)
                            </p>
                          ) : null}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Complete practice to see subject breakdowns here.
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)] lg:items-start">
        <section className="min-w-0 rounded-3xl border border-black/8 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
          <DashboardRecommendations
            actions={actions}
            loading={planLoading || subjectsLoading}
            greeting={greeting}
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

          <DashboardHotFeatures onOpenStats={() => setScoreCardOpen(true)} />
        </div>
      </div>
    </AppShell>
  );
}
