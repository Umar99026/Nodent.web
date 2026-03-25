import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BookOpen,
  MessageSquare,
  FileText,
  Plus,
  Search,
  X,
  GraduationCap,
  BarChart3,
  Star,
} from "lucide-react";

import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";

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

function getCompletedQuizCount(): number {
  let count = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_KEYS.practiceStatePrefix)) {
      try {
        const state = JSON.parse(localStorage.getItem(key) ?? "{}");
        if (state.completed) count++;
      } catch {
        // ignore malformed entries
      }
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = String(user?.id ?? "anonymous");

  const [mySubjects, setMySubjects] = useState<Subject[]>(() =>
    getMySubjects(userId),
  );
  const [searchQuery, setSearchQuery] = useState("");

  const quizCount = useMemo(() => getCompletedQuizCount(), []);

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
      const data = await apiFetch<ScorecardData>("/api/scorecard");
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

  /* ------ render ------ */

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Welcome back, ${user?.username ?? "Student"}`}
    >
      {/* Scorecard toggle */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setScoreCardOpen((v) => !v)}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-left transition-colors hover:bg-card"
        >
          <Avatar className="size-10">
            <AvatarFallback className="bg-brand/15 text-xs font-bold text-brand-light">
              {(user?.username ?? "Student")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "S"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-display text-lg font-semibold">
              {user?.username ?? "Student"}
            </div>
            <div className="text-xs text-muted-foreground">
              Tap to {scoreCardOpen ? "hide" : "view"} scorecard
            </div>
          </div>
        </button>
      </div>

      {scoreCardOpen && (
        <Card className="paper-texture mb-8 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <Star className="size-5 text-brand-dark" />
                Scorecard
              </CardTitle>
              <CardDescription>
                Sleek overview based on correct answers.
              </CardDescription>
            </div>
            <div className="text-right">
              {scoreCardLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : scoreCard?.overallRank ? (
                <>
                  <div className="font-display text-4xl font-bold leading-none">
                    {(() => {
                      const total = Math.max(1, scoreCard.totalStudents - 1);
                      const t = scoreCard.overallRank! - 1;
                      const rating = 10 - Math.round((t / total) * 9);
                      return Math.max(1, rating);
                    })()}
                    <span className="ml-1 text-sm text-muted-foreground">/10</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Rank #{scoreCard.overallRank} of {scoreCard.totalStudents}
                  </div>
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Not enough data yet.
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="grid gap-4 lg:grid-cols-4">
            <div className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Best subject</div>
              <div className="font-display text-lg font-semibold">
                {scoreCard?.bestSubjectId
                  ? baseSubjects.find((s) => s.id === scoreCard.bestSubjectId)?.name ??
                    scoreCard.bestSubjectId
                  : "—"}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Weakest subject</div>
              <div className="font-display text-lg font-semibold">
                {scoreCard?.weakestSubjectId
                  ? baseSubjects.find((s) => s.id === scoreCard.weakestSubjectId)?.name ??
                    scoreCard.weakestSubjectId
                  : "—"}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Study points</div>
              <div className="font-display text-lg font-semibold tabular-nums">
                {scoreCard?.points ?? 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Higher is better.
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-border/50 bg-card/40 p-4">
              <div className="text-xs text-muted-foreground">Avg daily study</div>
              <div className="font-display text-lg font-semibold tabular-nums">
                {avgDailyStudyMinutes} min
              </div>
              <div className="text-xs text-muted-foreground">
                Based on your timer today.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="paper-texture">
          <CardContent className="flex items-center gap-4 pt-1">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10">
              <GraduationCap className="size-5 text-brand" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {mySubjects.length}
              </p>
              <p className="text-sm text-muted-foreground">Subjects</p>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-texture">
          <CardContent className="flex items-center gap-4 pt-1">
            <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
              <BarChart3 className="size-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{quizCount}</p>
              <p className="text-sm text-muted-foreground">Quizzes</p>
            </div>
          </CardContent>
        </Card>

        <Card className="paper-texture sm:col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-4 pt-1">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber/10">
              <BookOpen className="size-5 text-amber" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">VCE</p>
              <p className="text-sm text-muted-foreground">Curriculum</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section header */}
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          My Subjects
        </h2>

        <DropdownMenu>
          <DropdownMenuTrigger {...({ asChild: true } as any)}>
            <Button variant="outline" className="gap-1.5">
              <Plus className="size-4" />
              Add Subject
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[420px] p-0">
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
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          }}
        >
          {mySubjects.map((subject) => (
            <Card key={subject.id} className="paper-texture relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="font-display text-lg">
                      {subject.name}
                    </CardTitle>
                    <Badge variant="secondary" className="text-[11px]">
                      VCE
                    </Badge>
                  </div>
                  <button
                    onClick={() => removeSubject(subject.id)}
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label={`Remove ${subject.name}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <CardDescription className="mt-1">
                  {subject.description}
                </CardDescription>
              </CardHeader>

              <CardFooter className="flex-wrap gap-2">
                <Button
                  size="sm"
                  className="flex-1 bg-brand text-white hover:bg-brand-dark"
                  onClick={() => navigate(`/quiz/${subject.id}`)}
                >
                  <BookOpen className="size-3.5" />
                  Practice
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/quiz/${subject.id}/summary`)}
                >
                  <FileText className="size-3.5" />
                  Summary
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => navigate(`/chat/${subject.id}`)}
                >
                  <MessageSquare className="size-3.5" />
                  Chat
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

    </AppShell>
  );
}
