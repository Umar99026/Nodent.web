import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  RotateCcw,
  LayoutDashboard,
  Star,
  AlertTriangle,
  Users,
  TrendingUp,
  Loader2,
  ArrowLeft,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PracticeState {
  currentIndex: number;
  answers: Record<string, boolean | null>;
  completedAt?: string;
}

interface LeaderboardEntry {
  userId: number;
  username: string;
  correct: number;
  total: number;
  percent: number;
}

interface TopicStat {
  topic: string;
  correctCount: number;
  totalAnswered: number;
  myCorrect: number | null;
  myTotal: number;
}

interface QuestionStat {
  questionKey: string;
  topic: string;
  correctCount: number;
  totalAnswered: number;
}

interface CompetitionStats {
  rank: number | null;
  percentile: number | null;
  totalStudents: number;
  leaderboard: LeaderboardEntry[];
  topicStats: TopicStat[];
  questionStats: QuestionStat[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getPracticeStorageKey(
  userId: number | string,
  subjectId: string
): string {
  return STORAGE_KEYS.practiceStatePrefix + userId + "_" + subjectId;
}

function loadPracticeState(
  userId: number | string,
  subjectId: string
): PracticeState | null {
  try {
    const raw = localStorage.getItem(
      getPracticeStorageKey(userId, subjectId)
    );
    if (!raw) return null;
    return JSON.parse(raw) as PracticeState;
  } catch {
    return null;
  }
}

function getPercentileBadge(percentile: number) {
  if (percentile >= 90)
    return { label: "Top 10%", className: "bg-success/15 text-success" };
  if (percentile >= 75)
    return { label: "Top 25%", className: "bg-brand/15 text-brand-dark" };
  if (percentile >= 50)
    return { label: "Top 50%", className: "bg-amber/15 text-amber" };
  return { label: `Top ${100 - Math.floor(percentile)}%`, className: "bg-muted text-muted-foreground" };
}

function getRankMedal(rank: number): string {
  if (rank === 1) return "\uD83E\uDD47";
  if (rank === 2) return "\uD83E\uDD48";
  if (rank === 3) return "\uD83E\uDD49";
  return `#${rank}`;
}

/* ------------------------------------------------------------------ */
/*  SummaryPage                                                        */
/* ------------------------------------------------------------------ */

export default function SummaryPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Find subject
  const subject: Subject | undefined = useMemo(() => {
    return baseSubjects.find((s) => s.id === subjectId);
  }, [subjectId]);

  // Load practice state
  const practiceState: PracticeState | null = useMemo(() => {
    if (!user || !subjectId) return null;
    return loadPracticeState(user.id, subjectId);
  }, [user, subjectId]);

  // Compute score from practice state
  const { correct, total, percentage } = useMemo(() => {
    if (!practiceState) return { correct: 0, total: 0, percentage: 0 };
    const entries = Object.values(practiceState.answers);
    const scorable = entries.filter((v) => v !== null);
    const correctCount = scorable.filter((v) => v === true).length;
    const totalCount = scorable.length;
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return { correct: correctCount, total: totalCount, percentage: pct };
  }, [practiceState]);

  // Fetch competition stats
  useEffect(() => {
    if (!subjectId) return;

    let cancelled = false;
    async function fetchStats() {
      try {
        const data = await apiFetch<CompetitionStats>(
          `/api/competition/${subjectId}/stats`
        );
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setStatsError(
            err instanceof Error ? err.message : "Failed to load stats."
          );
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [subjectId]);

  // Reset practice
  const handleReset = () => {
    if (!user || !subjectId) return;
    localStorage.removeItem(getPracticeStorageKey(user.id, subjectId));
    navigate(`/quiz/${subjectId}`);
  };

  if (!subjectId) {
    return (
      <AppShell title="Summary">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="font-display text-xl text-foreground">
            Subject not found
          </h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  const tooFewStudents =
    stats !== null && stats.totalStudents < 2;

  return (
    <AppShell title={subject ? `${subject.name} Summary` : "Summary"}>
      <div className="space-y-8">
        {/* ---- Score hero ---- */}
        <Card className="paper-texture overflow-hidden">
          <div className="bg-gradient-to-br from-brand/10 via-transparent to-brand-light/5">
            <CardContent className="flex flex-col items-center py-10 text-center">
              <div className="mb-4 rounded-full bg-brand/10 p-4">
                <Trophy className="size-10 text-brand-dark" />
              </div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                {correct} / {total}
              </h2>
              <p className="mt-1 text-lg text-muted-foreground">
                correct ({percentage}%)
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  onClick={handleReset}
                  variant="outline"
                  className="gap-2"
                >
                  <RotateCcw className="size-4" />
                  Reset Practice
                </Button>
                <Button
                  onClick={() => navigate(`/quiz/${subjectId}`)}
                  variant="outline"
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" />
                  Back to Practice
                </Button>
                <Button
                  onClick={() => navigate("/")}
                  className="gap-2 bg-brand hover:bg-brand-dark"
                >
                  <LayoutDashboard className="size-4" />
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* ---- Competition stats ---- */}
        {loadingStats ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-brand" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading competition stats...
            </span>
          </div>
        ) : statsError ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">{statsError}</p>
            </CardContent>
          </Card>
        ) : tooFewStudents ? (
          <Card>
            <CardContent className="flex flex-col items-center py-10 text-center">
              <Users className="size-8 text-muted-foreground" />
              <h3 className="mt-3 font-display text-lg font-medium text-foreground">
                Not enough data yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Competition stats require at least 2 students to have completed
                this quiz. Share the quiz with classmates to see rankings!
              </p>
            </CardContent>
          </Card>
        ) : stats ? (
          <div className="space-y-6">
            {/* ---- Rank card ---- */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="flex flex-col items-center py-6 text-center">
                  <span className="font-display text-3xl font-bold text-brand-dark">
                    {stats.rank ? getRankMedal(stats.rank) : "—"}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your Rank
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center py-6 text-center">
                  <Badge
                    className={`text-sm px-3 py-1 ${getPercentileBadge(stats.percentile ?? 0).className}`}
                  >
                    {getPercentileBadge(stats.percentile ?? 0).label}
                  </Badge>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Percentile
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex flex-col items-center py-6 text-center">
                  <span className="font-display text-3xl font-bold text-foreground">
                    {stats.totalStudents}
                  </span>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Total Students
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ---- Leaderboard ---- */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <TrendingUp className="size-5 text-brand-dark" />
                  Leaderboard
                </CardTitle>
                <CardDescription>
                  Top performers for this subject
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Score %</TableHead>
                      <TableHead className="text-right">Correct / Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.leaderboard.map((entry, idx) => {
                      const isMe = user && entry.userId === user.id;
                      return (
                        <TableRow
                          key={entry.userId}
                          className={
                            isMe
                              ? "bg-brand/8 font-medium"
                              : ""
                          }
                        >
                          <TableCell className="font-semibold">
                            {getRankMedal(idx + 1)}
                          </TableCell>
                          <TableCell>
                            {entry.username}
                            {isMe && (
                              <Badge
                                variant="secondary"
                                className="ml-2 text-xs"
                              >
                                You
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {entry.percent}%
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {entry.correct} / {entry.total}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ---- Topic breakdown ---- */}
            {stats.topicStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-display text-lg">
                    <Star className="size-5 text-amber" />
                    Topic Breakdown
                  </CardTitle>
                  <CardDescription>
                    Your score vs. class average per topic
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {stats.topicStats.map((topic) => {
                    const yourPct =
                      topic.myTotal > 0 && topic.myCorrect !== null
                        ? Math.round(
                            (topic.myCorrect / topic.myTotal) * 100
                          )
                        : 0;
                    const classPct = topic.totalAnswered > 0
                        ? Math.round((topic.correctCount / topic.totalAnswered) * 100)
                        : 0;
                    const above = yourPct >= classPct;
                    const isWeak = yourPct < 50;
                    const isStrong = yourPct >= 80;

                    return (
                      <div key={topic.topic} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {topic.topic}
                            </span>
                            {isStrong && (
                              <Star className="size-3.5 fill-amber text-amber" />
                            )}
                            {isWeak && (
                              <AlertTriangle className="size-3.5 text-danger" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs tabular-nums">
                            <span
                              className={
                                above ? "text-success font-semibold" : "text-danger font-semibold"
                              }
                            >
                              You: {yourPct}%
                            </span>
                            <span className="text-muted-foreground">
                              Class: {classPct}%
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {/* Your bar */}
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${above ? "bg-success" : "bg-danger"}`}
                              style={{ width: `${yourPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {/* ---- Per-question stats ---- */}
            {stats.questionStats.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-display text-lg">
                    Per-Question Class Stats
                  </CardTitle>
                  <CardDescription>
                    How the class performed on each question
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {stats.questionStats.map((qs, idx) => {
                    const pct = qs.totalAnswered > 0
                      ? Math.round((qs.correctCount / qs.totalAnswered) * 100)
                      : 0;
                    return (
                      <div key={qs.questionKey} className="space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-foreground/85 leading-relaxed">
                            <span className="font-semibold text-brand-dark">
                              Q{idx + 1}.
                            </span>{" "}
                            {qs.topic}
                          </p>
                          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                            {pct}% correct
                          </span>
                        </div>
                        <Progress value={pct} />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
