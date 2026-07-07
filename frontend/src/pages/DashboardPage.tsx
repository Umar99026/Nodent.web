import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api";
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
  type DashboardAction,
  type DashboardScorecard,
} from "@/lib/dashboardRecommendations";

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const userId = String(user?.id ?? "anonymous");
  const lastScorecardToastAtRef = useRef<number>(0);
  const dashboardActionStorageKey = useMemo(
    () => `nodent:dashboard-actions:v1:${userId}`,
    [userId],
  );
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
    } catch (err) {
      // Avoid toast spam: scorecard is refreshed in multiple places (including after answer submits).
      // Also avoid toasting on 401/session churn; AuthContext handles expiry.
      if (err instanceof ApiError && err.status === 401) return;
      const now = Date.now();
      if (now - lastScorecardToastAtRef.current < 12_000) return;
      lastScorecardToastAtRef.current = now;
      toast.error(
        err instanceof Error ? err.message : "Failed to load your report card.",
      );
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

  const computedActions = useMemo(
    () =>
      buildDashboardActions({
        subjects: mySubjects,
        scorecard: scoreCard,
        confidenceRanks,
      }),
    [mySubjects, scoreCard, confidenceRanks],
  );

  const [stableActions, setStableActions] = useState<DashboardAction[]>([]);

  useEffect(() => {
    if (!user) return;
    if (!computedActions.length) {
      setStableActions([]);
      return;
    }

    const today = localDateISO();
    type Stored = { date: string; actionIds: string[]; completedIds: string[] };

    const parseStored = (): Stored | null => {
      try {
        const raw = localStorage.getItem(dashboardActionStorageKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<Stored>;
        if (!parsed || typeof parsed !== "object") return null;
        if (typeof parsed.date !== "string") return null;
        if (!Array.isArray(parsed.actionIds) || !Array.isArray(parsed.completedIds)) return null;
        return {
          date: parsed.date,
          actionIds: parsed.actionIds.filter((x): x is string => typeof x === "string"),
          completedIds: parsed.completedIds.filter((x): x is string => typeof x === "string"),
        };
      } catch {
        return null;
      }
    };

    const writeStored = (next: Stored) => {
      localStorage.setItem(dashboardActionStorageKey, JSON.stringify(next));
    };

    const byId = new Map(computedActions.map((a) => [a.id, a]));
    const stored = parseStored();

    const seedForToday = (): Stored => ({
      date: today,
      actionIds: computedActions.map((a) => a.id),
      completedIds: [],
    });

    const effective = !stored || stored.date !== today ? seedForToday() : stored;

    // If they finished the whole plan, refresh immediately (same day).
    const completedSet = new Set(effective.completedIds);
    const allCompleted =
      effective.actionIds.length > 0 &&
      effective.actionIds.every((id) => completedSet.has(id));
    const finalStored = allCompleted ? seedForToday() : effective;
    if (!stored || stored.date !== finalStored.date || allCompleted) writeStored(finalStored);

    const picked: DashboardAction[] = [];
    const used = new Set<string>();
    for (const id of finalStored.actionIds) {
      const action = byId.get(id);
      if (!action) continue;
      if (finalStored.completedIds.includes(id)) continue;
      picked.push(action);
      used.add(id);
    }
    // Fill any gaps (e.g. action ids no longer exist) with new suggestions,
    // while still keeping the "daily plan" stable.
    for (const action of computedActions) {
      if (picked.length >= computedActions.length) break;
      if (used.has(action.id)) continue;
      if (finalStored.completedIds.includes(action.id)) continue;
      picked.push(action);
      used.add(action.id);
    }

    setStableActions(picked);
  }, [user, computedActions, dashboardActionStorageKey]);

  const markDashboardActionOpened = useCallback(
    (action: DashboardAction) => {
      if (!user) return;
      const today = localDateISO();
      type Stored = { date: string; actionIds: string[]; completedIds: string[] };
      try {
        const raw = localStorage.getItem(dashboardActionStorageKey);
        const parsed = raw ? (JSON.parse(raw) as Partial<Stored>) : null;
        const actionIds =
          parsed?.date === today && Array.isArray(parsed.actionIds)
            ? parsed.actionIds.filter((x): x is string => typeof x === "string")
            : computedActions.map((a) => a.id);
        const completedIds =
          parsed?.date === today && Array.isArray(parsed.completedIds)
            ? parsed.completedIds.filter((x): x is string => typeof x === "string")
            : [];

        const nextCompleted = new Set(completedIds);
        nextCompleted.add(action.id);
        const next: Stored = {
          date: today,
          actionIds,
          completedIds: Array.from(nextCompleted),
        };
        localStorage.setItem(dashboardActionStorageKey, JSON.stringify(next));
      } catch {
        // Best-effort only; if storage fails, the UI still works.
      }
    },
    [user, computedActions, dashboardActionStorageKey],
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
            actions={stableActions.length ? stableActions : computedActions}
            loading={scoreCardLoading || subjectsLoading}
            onActionOpen={markDashboardActionOpened}
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
