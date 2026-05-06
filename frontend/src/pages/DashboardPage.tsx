import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Plus,
  Search,
  X,
  Star,
} from "lucide-react";

import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";
import { localDateISO } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getMySubjects(userId: string): Subject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mySubjectsPrefix + userId);
    if (!raw) return [];
    return JSON.parse(raw) as Subject[];
  } catch {
    return [];
  }
}

function saveMySubjects(userId: string, subjects: Subject[]) {
  localStorage.setItem(
    STORAGE_KEYS.mySubjectsPrefix + userId,
    JSON.stringify(subjects),
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = String(user?.id ?? "anonymous");
  const initials = user?.username
    ? user.username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const [mySubjects, setMySubjects] = useState<Subject[]>(() =>
    getMySubjects(userId),
  );
  const [searchQuery, setSearchQuery] = useState("");

  /* ------ subject management ------ */

  const addSubject = useCallback(
    (subject: Subject) => {
      setMySubjects((prev) => {
        if (prev.some((s) => s.id === subject.id)) return prev;
        const next = [...prev, subject];
        saveMySubjects(userId, next);
        return next;
      });
      toast.success(`Added "${subject.name}" to your subjects`);
    },
    [userId],
  );

  const removeSubject = useCallback(
    (subjectId: string) => {
      setMySubjects((prev) => {
        const next = prev.filter((s) => s.id !== subjectId);
        saveMySubjects(userId, next);
        return next;
      });
    },
    [userId],
  );

  const availableSubjects = useMemo(() => {
    const myIds = new Set(mySubjects.map((s) => s.id));
    return baseSubjects.filter(
      (s) =>
        !myIds.has(s.id) &&
        s.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [mySubjects, searchQuery]);

  interface ScorecardData {
    totalStudents: number;
    overallRank: number | null;
    points: number;
    bestSubjectId: string | null;
    weakestSubjectId: string | null;
    studyStreak: number;
  }

  const [scoreCardOpen, setScoreCardOpen] = useState(false);
  const [scoreCardLoading, setScoreCardLoading] = useState(false);
  const [scoreCard, setScoreCard] = useState<ScorecardData | null>(null);

  const avgDailyStudyMinutes = useMemo(() => {
    if (!user) return 0;
    const uid = String(user.id);
    const today = new Date();
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${STORAGE_KEYS.studyPrefix}${uid}_${yyyy}-${mm}-${dd}`;
      try {
        const raw = localStorage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : null;
        const seconds = typeof parsed?.dailySeconds === "number" ? parsed.dailySeconds : 0;
        total += seconds / 60;
      } catch {
        // ignore
      }
    }
    return Math.round(total / 7);
  }, [user]);

  const fetchScorecard = useCallback(async () => {
    if (!user) return;
    try {
      setScoreCardLoading(true);
      const data = await apiFetch<ScorecardData>(
        `/api/scorecard?asOfDate=${encodeURIComponent(localDateISO())}`,
      );
      setScoreCard(data);
    } catch {
      toast.error("Failed to load your scorecard.");
    } finally {
      setScoreCardLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (scoreCardOpen && !scoreCard && user) {
      void fetchScorecard();
    }
  }, [scoreCardOpen, scoreCard, user, fetchScorecard]);

  // Live refresh while open
  useEffect(() => {
    if (!scoreCardOpen) return;
    const t = setInterval(() => {
      void fetchScorecard();
    }, 8000);
    return () => clearInterval(t);
  }, [scoreCardOpen, fetchScorecard]);

  /* ------ render ------ */

  return (
    <AppShell
      title=""
      subtitle={
        <>
          <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/70 sm:text-[0.8rem]">
            Welcome back,
          </span>
          <span className="mt-1.5 block text-[clamp(1.8rem,4.6vw,3.3rem)] font-black leading-[0.92] tracking-tight text-white/95">
            {user?.username ?? "Student"}
          </span>
        </>
      }
      hideTitle
      subtitleClassName="max-w-none text-left leading-none text-white"
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
      {scoreCardOpen && (
        <div className="fixed inset-0 z-[300]">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setScoreCardOpen(false)}
          />
          <div className="absolute inset-0 overflow-auto p-4 sm:p-8">
            <div className="mx-auto w-full max-w-5xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-white">
                  <div className="flex items-center gap-2">
                    <Star className="size-5 text-white/90" />
                    <span className="font-display text-xl font-semibold">
                      Scorecard
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/70">
                    Live rating based on your correct answers and marks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScoreCardOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-400/25 bg-red-500/90 text-white transition-colors hover:bg-red-500"
                  aria-label="Close scorecard"
                >
                  <X className="size-4" />
                </button>
              </div>

              <Card className="paper-texture overflow-hidden">
                <CardContent className="space-y-6 p-6">
                  {/* Soccer-style rating card */}
                  <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-b from-[#f3fbff] to-white p-6 shadow-xl">
                    <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_10%,rgba(86,171,230,0.22),transparent_55%)]" />
                    <div className="relative">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-12 shrink-0">
                            <AvatarImage
                              src={user?.profilePhoto ?? undefined}
                              alt={user?.username ?? "User"}
                            />
                            <AvatarFallback className="bg-[#0b0f19] text-sm font-bold text-white">
                              {user?.profilePhoto ? initials : "S"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="rounded-full bg-[#0b0f19] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                              {user?.username ?? "Student"}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold text-black/60">
                          Live
                        </div>
                      </div>

                      <div className="mt-5">
                        {scoreCardLoading ? (
                          <div className="text-sm text-black/60">Loading…</div>
                        ) : scoreCard?.overallRank ? (
                          (() => {
                            const percentile = Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(
                                  ((scoreCard.totalStudents - scoreCard.overallRank!) /
                                    Math.max(1, scoreCard.totalStudents - 1)) *
                                    100,
                                ),
                              ),
                            );

                            return (
                              <>
                                <div className="font-display text-6xl font-bold leading-none text-[#0b0f19] tabular-nums">
                                  {scoreCard.points ?? 0}
                                </div>
                                <div className="mt-2 text-sm font-semibold text-black/60">
                                  Total points
                                </div>
                                <div className="mt-1 text-sm font-semibold text-black/60">
                                  Rank #{scoreCard.overallRank} of {scoreCard.totalStudents}
                                </div>
                                <div className="mt-1 text-sm font-semibold text-black/70">
                                  Percentile: top {100 - percentile}%
                                </div>
                              </>
                            );
                          })()
                        ) : (
                          <div className="text-sm text-black/60">
                            Not enough data yet.
                          </div>
                        )}
                      </div>

                      <div className="mt-6 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-black/10 bg-white p-4">
                          <div className="text-[11px] font-semibold text-black/50">
                            Points
                          </div>
                          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#0b0f19]">
                            {scoreCard?.points ?? 0}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-black/10 bg-white p-4">
                          <div className="text-[11px] font-semibold text-black/50">
                            Avg daily study
                          </div>
                          <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-[#0b0f19]">
                            {avgDailyStudyMinutes}m
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid gap-4">
                    <div className="space-y-2 rounded-2xl border border-border/50 bg-card/40 p-5">
                      <div className="text-xs text-muted-foreground">
                        Best subject
                      </div>
                      <div className="font-display text-xl font-semibold">
                        {scoreCard?.bestSubjectId
                          ? baseSubjects.find((s) => s.id === scoreCard.bestSubjectId)?.name ??
                            scoreCard.bestSubjectId
                          : "—"}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/50 bg-card/40 p-5">
                      <div className="text-xs text-muted-foreground">
                        Weakest subject
                      </div>
                      <div className="font-display text-xl font-semibold">
                        {scoreCard?.weakestSubjectId
                          ? baseSubjects.find((s) => s.id === scoreCard.weakestSubjectId)?.name ??
                            scoreCard.weakestSubjectId
                          : "—"}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-border/50 bg-card/40 p-5">
                      <div className="text-xs text-muted-foreground">
                        Study streak
                      </div>
                      <div className="font-display text-xl font-semibold tabular-nums">
                        {scoreCard?.studyStreak ?? 0}{" "}
                        <span className="text-base font-medium text-muted-foreground">
                          days
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Consecutive days meeting your study goal (synced when you use
                        Track My Study while signed in).
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Subjects container */}
      <div className="mt-4 min-w-0 max-w-full rounded-3xl border border-white/20 bg-white/10 p-4 backdrop-blur-md sm:mt-5 sm:p-6 lg:mt-6 lg:p-8">
          {/* Section header */}
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  My Subjects
                </h2>

                {/* Add subjects icon */}
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Add subjects"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-white/15 text-white hover:bg-white/20"
                    >
                      <Plus className="size-4" />
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-[min(100vw-1.5rem,420px)] max-w-[calc(100vw-1.5rem)] p-0">
                    <div className="px-4 pb-2 pt-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search subjects..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    <ScrollArea className="max-h-[320px] px-4 pb-4">
                      {availableSubjects.length === 0 ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                          {baseSubjects.length === 0
                            ? "No subjects available yet."
                            : "All subjects have been added or none match your search."}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {availableSubjects.map((subject) => (
                            <button
                              key={subject.id}
                              onClick={() => addSubject(subject)}
                              className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-card"
                            >
                              <div>
                                <p className="font-medium text-foreground">
                                  {subject.name}
                                </p>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {subject.description}
                                </p>
                              </div>
                              <Plus className="size-4 shrink-0 text-brand" />
                            </button>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <p className="mt-1 text-sm text-white/80">
                Manage your daily study, launch practice, and open subject discussion today.
              </p>
            </div>
          </div>

          {/* Subject grid */}
          {mySubjects.length === 0 ? (
            <Card className="paper-texture flex flex-col items-center justify-center py-16">
              <CardContent className="flex flex-col items-center text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand/10">
                  <BookOpen className="size-7 text-brand" />
                </div>
                <h3 className="font-display text-lg font-semibold">
                  No subjects yet
                </h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Get started by adding subjects to your dashboard. Click the
                  &ldquo;Add Subject&rdquo; button above to browse available VCE
                  subjects.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mySubjects.map((subject) => (
                <Card
                  key={subject.id}
                  className="group relative flex min-h-0 min-w-0 flex-col gap-0 overflow-x-clip overflow-y-visible rounded-2xl border border-black/10 bg-white p-0 py-0 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-brand/10 via-transparent to-transparent" />
                  <CardHeader className="relative z-10 border-b-0 p-4 pb-2 sm:p-5">
                    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1 space-y-1 pr-1">
                        <CardTitle className="font-display break-words text-lg leading-snug text-[#0b0f19] sm:text-xl">
                          {subject.name}
                        </CardTitle>
                        <CardDescription className="break-words text-sm leading-relaxed text-[#0b0f19]/70">
                          {subject.description}
                        </CardDescription>
                      </div>

                      <div className="flex shrink-0 items-start gap-1.5 sm:gap-2">
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-[#faf8f5] border border-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black sm:px-3 sm:text-xs"
                        >
                          vce
                        </Badge>

                        <button
                          type="button"
                          onClick={() => removeSubject(subject.id)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-500/85 text-white border border-red-500/25 transition-colors hover:bg-red-500"
                          aria-label={`Remove ${subject.name}`}
                        >
                          <X className="size-4 text-white" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardFooter className="relative z-10 mt-auto flex min-w-0 flex-col gap-2 border-t-0 bg-transparent p-4 pt-0 sm:p-5 sm:pt-0 lg:flex-row lg:flex-wrap">
                    <Button
                      size="sm"
                      className="h-11 min-h-11 w-full min-w-0 shrink-0 bg-[#0b0f19] px-2 text-sm text-white hover:bg-[#0b0f19]/90 lg:flex-1 lg:px-3"
                      onClick={() => navigate(`/quiz/${subject.id}`)}
                    >
                      Practice
                    </Button>
                    <Button
                      size="sm"
                      className="h-11 min-h-11 w-full min-w-0 shrink-0 bg-[#0b0f19] px-2 text-[clamp(0.7rem,2.8vw,0.875rem)] text-white hover:bg-[#0b0f19]/90 sm:text-sm lg:flex-1 lg:px-3"
                      onClick={() => navigate(`/quiz/${subject.id}/summary`)}
                    >
                      Statistics
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
      </div>

    </AppShell>
  );
}
