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
  Users,
} from "lucide-react";

import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";
import { localDateISO } from "@/lib/utils";
import { isAdminUser } from "@/lib/constants";
import { fetchClassMembership } from "@/lib/teacherClass";

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

function withAdminDemoSubject(subjects: Subject[], isAdmin: boolean): Subject[] {
  if (!isAdmin) return subjects.filter((s) => s.id !== "demo");
  if (subjects.some((s) => s.id === "demo")) return subjects;
  const demo = subjectsForUser({ isAdmin: true }).find((s) => s.id === "demo");
  return demo ? [...subjects, demo] : subjects;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const navigate = useNavigate();
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

  const [mySubjects, setMySubjects] = useState<Subject[]>(() =>
    withAdminDemoSubject(getMySubjects(userId), isAdmin),
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Sync subjects from server so logins don't lose your dashboard selection.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ subjectIds: string[] }>("/api/subjects/my");
        if (cancelled) return;
        const ids = new Set((data.subjectIds ?? []).map(String));
        if (ids.size === 0) return;
        const visible = subjectsForUser({ isAdmin });
        const next = withAdminDemoSubject(visible.filter((s) => ids.has(s.id)), isAdmin);
        setMySubjects(next);
        saveMySubjects(userId, next);
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, userId, isAdmin]);

  /* ------ subject management ------ */

  const addSubject = useCallback(
    (subject: Subject) => {
      setMySubjects((prev) => {
        if (prev.some((s) => s.id === subject.id)) return prev;
        const next = [...prev, subject];
        saveMySubjects(userId, next);
        if (user) {
          void apiFetch("/api/subjects/my", {
            method: "PUT",
            body: JSON.stringify({ subjectIds: next.map((s) => s.id) }),
          }).catch(() => {});
        }
        return next;
      });
      toast.success(`Added "${subject.name}" to your subjects`);
    },
    [userId, user],
  );

  const removeSubject = useCallback(
    (subjectId: string) => {
      setMySubjects((prev) => {
        const next = prev.filter((s) => s.id !== subjectId);
        saveMySubjects(userId, next);
        if (user) {
          void apiFetch("/api/subjects/my", {
            method: "PUT",
            body: JSON.stringify({ subjectIds: next.map((s) => s.id) }),
          }).catch(() => {});
        }
        return next;
      });
    },
    [userId, user],
  );

  const availableSubjects = useMemo(() => {
    const myIds = new Set(mySubjects.map((s) => s.id));
    const visible = subjectsForUser({ isAdmin });
    return visible.filter(
      (s) =>
        !myIds.has(s.id) &&
        s.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [mySubjects, searchQuery, isAdmin]);

  interface ScorecardData {
    totalStudents: number;
    overallRank: number | null;
    marks: number;
    overallPercentile: number | null;
    bestSubjectId: string | null;
    weakestSubjectId: string | null;
    studyStreak: number;
    reportSubjects?: Array<{
      subjectId: string;
      attempts: number;
      percentile: number | null;
      weakestTopic: { topic: string; percent: number } | null;
      strongestTopic: { topic: string; percent: number } | null;
    }>;
  }

  const [scoreCardOpen, setScoreCardOpen] = useState(false);
  const [scoreCardLoading, setScoreCardLoading] = useState(false);
  const [scoreCard, setScoreCard] = useState<ScorecardData | null>(null);
  const [classMembership, setClassMembership] = useState<{
    enrolled: boolean;
    className?: string;
    teacherName?: string;
  }>({ enrolled: false });

  useEffect(() => {
    if (!user || isAdmin) return;
    let cancelled = false;
    void fetchClassMembership()
      .then((data) => {
        if (!cancelled) setClassMembership(data);
      })
      .catch(() => {
        if (!cancelled) setClassMembership({ enrolled: false });
      });
    return () => {
      cancelled = true;
    };
  }, [user, isAdmin]);

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

  const fetchScorecard = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user) return;
    try {
      if (!opts?.silent) setScoreCardLoading(true);
      const data = await apiFetch<ScorecardData>(
        `/api/scorecard?asOfDate=${encodeURIComponent(localDateISO())}`,
      );
      setScoreCard(data);
    } catch {
      if (!opts?.silent) toast.error("Failed to load your report card.");
    } finally {
      if (!opts?.silent) setScoreCardLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (scoreCardOpen && !scoreCard && user) {
      void fetchScorecard();
    }
  }, [scoreCardOpen, scoreCard, user, fetchScorecard]);

  // Refresh points immediately after a question is answered (Quiz/Practice).
  useEffect(() => {
    const onScorecardUpdated = () => {
      if (!scoreCardOpen) {
        // Ensure next open fetches fresh data.
        setScoreCard(null);
        return;
      }
      void fetchScorecard({ silent: true });
    };
    window.addEventListener("nodent:scorecard-updated", onScorecardUpdated);
    return () => window.removeEventListener("nodent:scorecard-updated", onScorecardUpdated);
  }, [scoreCardOpen, fetchScorecard]);

  // No polling — reduces flicker/glitching. Refresh happens on open + after answers.

  /* ------ render ------ */

  return (
    <AppShell
      title=""
      subtitle={
        <>
          <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-[0.8rem]">
            Welcome back,
          </span>
          <span className="mt-1.5 block max-w-full truncate text-[clamp(1.5rem,6vw,3.3rem)] font-black leading-[0.92] tracking-tight text-[#0b0f19] sm:whitespace-normal sm:overflow-visible">
            {user?.username ?? "Student"}
          </span>
        </>
      }
      hideTitle
      subtitleClassName="max-w-none text-left leading-none"
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
            className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
            onClick={() => setScoreCardOpen(false)}
          />
          <div className="absolute inset-0 overflow-auto p-4 sm:p-8">
            <div className="mx-auto w-full max-w-5xl rounded-3xl border border-black/8 bg-white p-4 shadow-sm sm:p-6 lg:p-8">
              {/* Section header — matches My Subjects */}
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h2 className="font-display text-2xl font-bold tracking-tight text-[#0b0f19] sm:text-3xl">
                      Report Card
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {user?.username ?? "Student"} · Live summary based on your marks and
                    overall performance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setScoreCardOpen(false)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 bg-black/[0.04] text-[#0b0f19] transition-colors hover:bg-black/[0.08]"
                  aria-label="Close scorecard"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Top stats — compact black tiles like subject cards */}
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
                    label: "Avg daily study",
                    value: `${avgDailyStudyMinutes}m`,
                  },
                  {
                    label: "Study streak",
                    value: `${scoreCard?.studyStreak ?? 0}d`,
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="group relative overflow-hidden rounded-2xl border border-black/20 bg-[#0b0f19] p-4 shadow-sm sm:p-5"
                  >
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
                    <div className="relative z-10">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                        {stat.label}
                      </div>
                      <div className="mt-1 font-display text-2xl font-semibold tabular-nums text-white sm:text-3xl">
                        {stat.value}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subject breakdown — card grid like My Subjects */}
              {scoreCardLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (scoreCard?.reportSubjects?.length ?? 0) > 0 ? (
                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {(scoreCard?.reportSubjects ?? []).map((s) => {
                    const name =
                      baseSubjects.find((x) => x.id === s.subjectId)?.name ?? s.subjectId;
                    const weak = s.weakestTopic
                      ? `${s.weakestTopic.topic} (${s.weakestTopic.percent}%)`
                      : "—";
                    const strong = s.strongestTopic
                      ? `${s.strongestTopic.topic} (${s.strongestTopic.percent}%)`
                      : "—";
                    return (
                      <Card
                        key={s.subjectId}
                        className="group relative flex min-h-0 flex-col gap-0 overflow-hidden rounded-2xl border border-black/20 bg-[#0b0f19] p-0 py-0 text-white shadow-sm"
                      >
                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
                        <CardHeader className="relative z-10 border-b-0 p-4 pb-2 sm:p-5">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <CardTitle className="font-display break-words text-lg leading-snug text-white sm:text-xl">
                              {name}
                            </CardTitle>
                            <Badge
                              variant="secondary"
                              className="shrink-0 rounded-full border border-white/20 bg-brand-light/50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#0b0f19] sm:px-3 sm:text-xs"
                            >
                              {s.percentile != null ? `${Math.round(s.percentile)}%` : "—"}
                            </Badge>
                          </div>
                          <CardDescription className="mt-2 space-y-1.5 text-sm leading-relaxed text-white/70">
                            <span className="block">
                              <span className="font-medium text-white/85">Weakest:</span> {weak}
                            </span>
                            <span className="block">
                              <span className="font-medium text-white/85">Strongest:</span>{" "}
                              {strong}
                            </span>
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center border border-black/8 bg-[#f3f4f6]/40 py-12">
                  <CardContent className="flex flex-col items-center text-center">
                    <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-black/[0.04]">
                      <Star className="size-7 text-muted-foreground" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-[#0b0f19]">
                      No subject data yet
                    </h3>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Complete practice in your subjects to see weakest topics, strengths, and
                      percentiles here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {!isAdmin && !classMembership.enrolled ? (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4 sm:mt-5 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/15 text-brand">
                <Users className="size-5" />
              </div>
              <div>
                <p className="font-semibold text-[#0b0f19]">Join your class</p>
                <p className="text-sm text-muted-foreground">
                  Enter the code from your teacher or scan their QR code.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="shrink-0"
              onClick={() => navigate("/join-class")}
            >
              Join class
            </Button>
          </div>
        </div>
      ) : null}

      {!isAdmin && classMembership?.enrolled ? (
        <div className="mt-4 rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-muted-foreground sm:mt-5">
          In <span className="font-medium text-foreground">{classMembership.className}</span>
          {classMembership.teacherName ? ` with ${classMembership.teacherName}` : ""}
        </div>
      ) : null}

      {/* Subjects container */}
      <div className="mt-4 min-w-0 max-w-full rounded-3xl border border-black/8 bg-white p-4 shadow-sm sm:mt-5 sm:p-6 lg:mt-6 lg:p-8">
          {/* Section header */}
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-2xl font-bold tracking-tight text-[#0b0f19] sm:text-3xl">
                  My Subjects
                </h2>

                {/* Add subjects icon */}
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Add subjects"
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-black/[0.04] text-[#0b0f19] hover:bg-black/[0.08]"
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

              <p className="mt-1 text-sm text-muted-foreground">
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
                  className="group relative flex min-h-0 min-w-0 flex-col gap-0 overflow-x-clip overflow-y-visible rounded-2xl border border-black/20 bg-[#0b0f19] p-0 py-0 text-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />
                  <CardHeader className="relative z-10 border-b-0 p-4 pb-2 sm:p-5">
                    <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
                      <div className="min-w-0 flex-1 space-y-1 pr-1">
                        <CardTitle className="font-display break-words text-lg leading-snug text-white sm:text-xl">
                          {subject.name}
                        </CardTitle>
                        <CardDescription className="break-words text-sm leading-relaxed text-white/70">
                          {baseSubjects.find((s) => s.id === subject.id)?.description ??
                            subject.description}
                        </CardDescription>
                      </div>

                      <div className="flex shrink-0 items-start gap-1.5 sm:gap-2">
                        <Badge
                          variant="secondary"
                          className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/90 sm:px-3 sm:text-xs"
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
                      className="h-11 min-h-11 w-full min-w-0 shrink-0 bg-brand-light/50 px-2 text-sm text-[#0b0f19] hover:bg-brand-light/70 lg:flex-1 lg:px-3"
                      onClick={() => navigate(`/practice/${subject.id}`)}
                    >
                      Practice
                    </Button>
                    <Button
                      size="sm"
                      className="h-11 min-h-11 w-full min-w-0 shrink-0 bg-brand-light/50 px-2 text-[clamp(0.7rem,2.8vw,0.875rem)] text-[#0b0f19] hover:bg-brand-light/70 sm:text-sm lg:flex-1 lg:px-3"
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
