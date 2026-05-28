import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  getRawCustomQuestionsForSubject,
  normalizeCustomQuestionsList,
  practiceQuestionsForSubject,
} from "@/lib/practiceQuestions";
import {
  getStableQuestionIndex,
  normalizeAnswerMap,
  questionKeyStable,
  resolveAnswerKey,
  resolveQuestionForPractice,
} from "@/lib/practiceKeys";
import { cn } from "@/lib/utils";
import {
  getQuestionGroupKey,
  randomizedQuestionsForSubject,
} from "@/lib/quizShuffle";
import { baseSubjects } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
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
  LayoutDashboard,
  Star,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ListX,
  XCircle,
  X,
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
  attemptCount?: number;
}

interface TopicStat {
  topic: string;
  correctCount: number;
  totalAnswered: number;
  myCorrect: number | null;
  myTotal: number;
  topicPercentile?: number | null;
}

interface QuestionStat {
  questionKey: string;
  topic: string;
  correctCount: number;
  totalAnswered: number;
  fullyCorrectPercent?: number;
}

interface CompetitionStats {
  rank: number | null;
  percentile: number | null;
  totalStudents: number;
  leaderboard: LeaderboardEntry[];
  topicStats: TopicStat[];
  questionStats: QuestionStat[];
  minRankedAttempts?: number;
}

type EnglishResponse = {
  id: number;
  promptId: number;
  prompt: string;
  userId: number;
  username: string;
  responseType: "essay" | "paragraph";
  responseText: string;
  imageUrls: string[];
  updatedAt: string;
  averageScore: number | null;
  ratingCount: number;
  myScore: number | null;
  section?: "A" | "B" | "C";
};

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

function savePracticeState(
  userId: number | string,
  subjectId: string,
  state: PracticeState,
) {
  localStorage.setItem(
    getPracticeStorageKey(userId, subjectId),
    JSON.stringify(state),
  );
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
/*  StatisticsPage                                                     */
/* ------------------------------------------------------------------ */

export default function SummaryPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [leaderboardRange, setLeaderboardRange] = useState<"week" | "all">(
    "all",
  );

  const [stats, setStats] = useState<CompetitionStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [englishResponses, setEnglishResponses] = useState<EnglishResponse[]>([]);
  const [showHighScoring, setShowHighScoring] = useState(false);
  const [openEnglishResponseId, setOpenEnglishResponseId] = useState<number | null>(null);

  // Find subject
  const subject: Subject | undefined = useMemo(() => {
    return baseSubjects.find((s) => s.id === subjectId);
  }, [subjectId]);

  // Load practice state
  const practiceState: PracticeState | null = useMemo(() => {
    if (!user || !subjectId) return null;
    return loadPracticeState(user.id, subjectId);
  }, [user, subjectId]);

  // Compute score hero from all-time competition stats (mark-weighted),
  // falling back to local practice state when stats are unavailable.
  const { correct, total, percentage, wrongCount } = useMemo(() => {
    // Prefer server stats (consistent with leaderboard units).
    if (stats?.topicStats?.length) {
      let myCorrectMarks = 0;
      let myTotalMarks = 0;
      for (const t of stats.topicStats) {
        const c = t.myCorrect == null ? null : Number(t.myCorrect);
        const tot = Number(t.myTotal ?? 0);
        if (c == null || tot <= 0) continue;
        myCorrectMarks += Math.max(0, c);
        myTotalMarks += Math.max(0, tot);
      }
      const pct =
        myTotalMarks > 0
          ? Math.round((myCorrectMarks / myTotalMarks) * 100)
          : 0;
      // wrongCount is a separate “review list” concept — keep it sourced from local practice state.
      const wrong =
        practiceState?.answers
          ? Object.values(practiceState.answers).filter((v) => v === false).length
          : 0;
      return {
        correct: myCorrectMarks,
        total: myTotalMarks,
        percentage: pct,
        wrongCount: wrong,
      };
    }

    if (!practiceState) {
      return { correct: 0, total: 0, percentage: 0, wrongCount: 0 };
    }
    let answers = practiceState.answers;
    let wrong = 0;
    if (user && subjectId && questions.length > 0) {
      const rand = randomizedQuestionsForSubject(questions, user.id, subjectId);
      const extra = getCustomQuestionsFromStorage(subjectId);
      answers = normalizeAnswerMap(
        subjectId,
        practiceState.answers,
        questions,
        rand,
        extra,
      );
      const falseKeys = new Set<string>();
      for (const [k, v] of Object.entries(answers)) {
        if (v === false) falseKeys.add(k);
      }
      for (const [k, v] of Object.entries(practiceState.answers)) {
        if (v === false) falseKeys.add(k);
      }
      for (const key of falseKeys) {
        if (
          resolveQuestionForPractice(
            subjectId,
            key,
            questions,
            rand,
            extra,
          )
        ) {
          wrong += 1;
        }
      }
    } else {
      wrong = Object.values(answers).filter((v) => v === false).length;
    }
    const entries = Object.values(answers);
    const scorable = entries.filter((v) => v !== null);
    const correctCount = scorable.filter((v) => v === true).length;
    const totalCount = scorable.length;
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
    return { correct: correctCount, total: totalCount, percentage: pct, wrongCount: wrong };
  }, [stats, practiceState, user, subjectId, questions]);

  /** Raw false entries in localStorage (before bank matching). */
  const savedWrongCount = useMemo(() => {
    if (!practiceState?.answers) return 0;
    return Object.values(practiceState.answers).filter((v) => v === false)
      .length;
  }, [practiceState]);

  const minRanked = stats?.minRankedAttempts ?? 10;
  const canCompareClass = (stats?.totalStudents ?? 0) >= 2;

  function getCustomQuestionsFromStorage(subjectId: string): Question[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.customQuestions);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Record<string, unknown[]>;
      return normalizeCustomQuestionsList(
        getRawCustomQuestionsForSubject(parsed, subjectId),
        subjectId,
      );
    } catch {
      return [];
    }
  }

  useEffect(() => {
    if (!user || !subjectId) {
      setQuestions([]);
      setQuestionsLoading(false);
      return;
    }
    let cancelled = false;
    setQuestionsLoading(true);
    (async () => {
      try {
        const data = await apiFetch<{
          customQuestions?: Record<string, unknown[]>;
        }>(API_PATHS.bootstrap);
        if (cancelled) return;
        if (data?.customQuestions) {
          localStorage.setItem(
            STORAGE_KEYS.customQuestions,
            JSON.stringify(data.customQuestions),
          );
        }
        const raw = getRawCustomQuestionsForSubject(
          data?.customQuestions,
          subjectId,
        );
        setQuestions(practiceQuestionsForSubject(raw, subjectId));
      } catch {
        if (!cancelled) {
          const stored = getCustomQuestionsFromStorage(subjectId);
          setQuestions(
            stored.length
              ? stored
              : practiceQuestionsForSubject([], subjectId),
          );
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subjectId]);

  const randForSummary = useMemo(() => {
    if (!user?.id || !subjectId || questions.length === 0) return [];
    return randomizedQuestionsForSubject(questions, user.id, subjectId);
  }, [user, subjectId, questions]);

  /** Custom rows kept in localStorage (may include ids no longer in the active bank). */
  const extraQuestionsForResolve = useMemo(() => {
    if (!subjectId) return [];
    return getCustomQuestionsFromStorage(subjectId);
  }, [subjectId, questions]);

  const practiceAnswersMigratedRef = useRef<string | null>(null);

  // Re-save practice answers under canonical keys once the bank is loaded.
  useEffect(() => {
    if (!user || !subjectId || questions.length === 0 || !practiceState) return;
    const sig = `${user.id}_${subjectId}_${questions.length}`;
    if (practiceAnswersMigratedRef.current === sig) return;
    const norm = normalizeAnswerMap(
      subjectId,
      practiceState.answers,
      questions,
      randForSummary,
      extraQuestionsForResolve,
    );
    if (JSON.stringify(norm) !== JSON.stringify(practiceState.answers)) {
      savePracticeState(user.id, subjectId, { ...practiceState, answers: norm });
    }
    practiceAnswersMigratedRef.current = sig;
  }, [
    user,
    subjectId,
    questions.length,
    practiceState,
    randForSummary,
    extraQuestionsForResolve,
  ]);

  const fetchEnglishResponses = useMemo(
    () => async () => {
      if (subjectId !== "english" || !user) return;
      const [a, b, c] = await Promise.all([
        apiFetch<{ responses: EnglishResponse[] }>(
          `${API_PATHS.english.responses}?section=A`,
        ),
        apiFetch<{ responses: EnglishResponse[] }>(
          `${API_PATHS.english.responses}?section=B`,
        ),
        apiFetch<{ responses: EnglishResponse[] }>(
          `${API_PATHS.english.responses}?section=C`,
        ),
      ]);
      const merged = [...(a.responses || []), ...(b.responses || []), ...(c.responses || [])];
      const byId = new Map<number, EnglishResponse>();
      for (const row of merged) byId.set(Number(row.id), row);
      setEnglishResponses(Array.from(byId.values()));
    },
    [subjectId, user],
  );

  useEffect(() => {
    if (subjectId !== "english" || !user) return;
    let cancelled = false;
    (async () => {
      try {
        await fetchEnglishResponses();
      } catch {
        if (!cancelled) setEnglishResponses([]);
      }
    })();
    const t = setInterval(() => {
      void fetchEnglishResponses().catch(() => {});
    }, 6000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [subjectId, user, fetchEnglishResponses]);

  /** Normalized saved answers (same bank + shuffle order as quiz). */
  const normalizedPracticeAnswers = useMemo((): Record<
    string,
    boolean | null
  > => {
    if (
      !subjectId ||
      !practiceState?.answers ||
      Object.keys(practiceState.answers).length === 0 ||
      questions.length === 0
    ) {
      return {};
    }
    return normalizeAnswerMap(
      subjectId,
      practiceState.answers,
      questions,
      randForSummary,
      extraQuestionsForResolve,
    );
  }, [
    practiceState,
    subjectId,
    questions,
    randForSummary,
    extraQuestionsForResolve,
  ]);

  /** Your saved answers for this subject (canonical key → score; null = not auto-scored). */
  const myAnswerByCanonicalKey = useMemo(() => {
    if (!subjectId || Object.keys(normalizedPracticeAnswers).length === 0) {
      return new Map<string, boolean | null>();
    }
    const m = new Map<string, boolean | null>();
    for (const [k, v] of Object.entries(normalizedPracticeAnswers)) {
      const r = resolveQuestionForPractice(
        subjectId,
        k,
        questions,
        randForSummary,
        extraQuestionsForResolve,
      );
      const ck = r?.canonicalKey ?? k;
      const prev = m.get(ck);
      if (v === false || prev === false) m.set(ck, false);
      else if (v === true || prev === true) m.set(ck, true);
      else m.set(ck, v);
    }
    return m;
  }, [
    subjectId,
    questions,
    randForSummary,
    normalizedPracticeAnswers,
    extraQuestionsForResolve,
  ]);

  /** Per-topic counts from your saved answers (fills gaps when the server has no row yet). */
  const localTopicRollup = useMemo(() => {
    const m = new Map<string, { myCorrect: number; myTotal: number }>();
    if (!subjectId || questions.length === 0) return m;
    for (const q of questions) {
      const qk = questionKeyStable(
        subjectId,
        q,
        Math.max(0, getStableQuestionIndex(questions, q)),
      );
      const v = myAnswerByCanonicalKey.get(qk);
      if (v === undefined) continue;
      const t = (q.topic || "General").trim() || "General";
      const cur = m.get(t) ?? { myCorrect: 0, myTotal: 0 };
      // Stats are mark-based (not question-count based) to match the leaderboard/competition API.
      const marks = Math.max(1, Math.round(Number((q as any).marks ?? 1)));
      cur.myTotal += marks;
      if (v === true) cur.myCorrect += marks;
      m.set(t, cur);
    }
    return m;
  }, [subjectId, questions, myAnswerByCanonicalKey]);

  const displayTopicStats = useMemo((): TopicStat[] => {
    if (!stats) return [];
    const local = localTopicRollup;
    const topics = new Set<string>();
    stats.topicStats.forEach((t) => topics.add(t.topic));
    local.forEach((_, t) => topics.add(t));
    return Array.from(topics)
      .sort((a, b) => a.localeCompare(b))
      .map((topic) => {
        const api = stats.topicStats.find((x) => x.topic === topic);
        const loc = local.get(topic);
        // Local answers are only a fallback (e.g. first session before the API has rows).
        // They must never override all-time API stats, otherwise "wrong answers only"
        // sessions can make the UI look like your percentage reset.
        const useLocal =
          loc &&
          loc.myTotal > 0 &&
          (!api || Number(api.myTotal ?? 0) <= 0 || api.myCorrect == null);
        return {
          topic,
          correctCount: api?.correctCount ?? 0,
          totalAnswered: api?.totalAnswered ?? 0,
          myCorrect: useLocal ? loc.myCorrect : (api?.myCorrect ?? null),
          myTotal: useLocal ? loc.myTotal : (api?.myTotal ?? 0),
          topicPercentile: api?.topicPercentile,
        };
      });
  }, [stats, localTopicRollup]);

  /** Topic with the lowest your % (least marks) among topics you’ve attempted. */
  const weakestTopicInfo = useMemo(() => {
    const candidates = displayTopicStats.filter(
      (t) => t.myTotal > 0 && t.myCorrect !== null,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((worst, t) => {
      const pct = (t.myCorrect! / t.myTotal) * 100;
      const worstPct = (worst.myCorrect! / worst.myTotal) * 100;
      if (pct < worstPct) return t;
      if (pct > worstPct) return worst;
      return t.topic.localeCompare(worst.topic) < 0 ? t : worst;
    });
  }, [displayTopicStats]);

  const mergedQuestionStats = useMemo((): QuestionStat[] => {
    if (!stats || !subjectId || questions.length === 0) {
      return stats?.questionStats ?? [];
    }
    const byKey = new Map(stats.questionStats.map((q) => [q.questionKey, q]));
    for (const canon of myAnswerByCanonicalKey.keys()) {
      if (byKey.has(canon)) continue;
      const r = resolveAnswerKey(subjectId, canon, questions, randForSummary);
      const topicLabel =
        (r?.q.question && r.q.question.length > 100
          ? `${r.q.question.slice(0, 100)}…`
          : r?.q.question) ||
        r?.q.topic ||
        "Question";
      byKey.set(canon, {
        questionKey: canon,
        topic: topicLabel,
        correctCount: 0,
        totalAnswered: 0,
        fullyCorrectPercent: 0,
      });
    }
    const list = Array.from(byKey.values());
    list.sort((a, b) => {
      const ra = resolveAnswerKey(subjectId, a.questionKey, questions, randForSummary);
      const rb = resolveAnswerKey(subjectId, b.questionKey, questions, randForSummary);
      const ia = ra ? getStableQuestionIndex(questions, ra.q) : 0;
      const ib = rb ? getStableQuestionIndex(questions, rb.q) : 0;
      return ia - ib;
    });
    return list;
  }, [stats, subjectId, questions, randForSummary, myAnswerByCanonicalKey]);

  /** Rows to show under Wrong answers — built from saved incorrect answers, not filtered API stats. */
  const wrongQuestionRows = useMemo(() => {
    if (!subjectId || questions.length === 0) return [];

    const statByCanonical = new Map<string, QuestionStat>();
    for (const qs of mergedQuestionStats) {
      const resolved = resolveAnswerKey(
        subjectId,
        qs.questionKey,
        questions,
        randForSummary,
      );
      const ck = resolved?.canonicalKey ?? qs.questionKey;
      statByCanonical.set(ck, qs);
    }

    const seenGroup = new Set<string>();
    const rows: {
      canonicalKey: string;
      question: Question;
      classStat: QuestionStat | null;
    }[] = [];

    const falseKeys = new Set<string>();
    for (const [k, v] of Object.entries(normalizedPracticeAnswers)) {
      if (v === false) falseKeys.add(k);
    }
    for (const [k, v] of Object.entries(practiceState?.answers ?? {})) {
      if (v === false) falseKeys.add(k);
    }

    for (const key of falseKeys) {
      const resolved = resolveQuestionForPractice(
        subjectId,
        key,
        questions,
        randForSummary,
        extraQuestionsForResolve,
      );
      if (!resolved) continue;
      const groupKey = getQuestionGroupKey(resolved.q, questions);
      if (seenGroup.has(groupKey)) continue;
      seenGroup.add(groupKey);

      rows.push({
        canonicalKey: resolved.canonicalKey,
        question: resolved.q,
        classStat:
          statByCanonical.get(resolved.canonicalKey) ??
          statByCanonical.get(key) ??
          null,
      });
    }

    rows.sort(
      (a, b) =>
        getStableQuestionIndex(questions, a.question) -
        getStableQuestionIndex(questions, b.question),
    );
    return rows;
  }, [
    subjectId,
    questions,
    randForSummary,
    normalizedPracticeAnswers,
    mergedQuestionStats,
    practiceState,
    extraQuestionsForResolve,
  ]);

  // Fetch competition stats
  useEffect(() => {
    if (!subjectId) return;

    let cancelled = false;
    async function fetchStats() {
      try {
        const rangeParam = leaderboardRange === "week" ? "week" : "all";
        const data = await apiFetch<CompetitionStats>(
          `/api/competition/${subjectId}/stats?range=${rangeParam}`
        );
        if (!cancelled) {
          setStats(data);
          setStatsError(null);
        }
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
  }, [subjectId, leaderboardRange]);

  if (!subjectId) {
    return (
      <AppShell title="Statistics">
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

  if (subjectId === "english") {
    const myRows = englishResponses.filter(
      (r) => Number(r.userId) === Number(user?.id),
    );
    const openEnglishResponse =
      myRows.find((r) => r.id === openEnglishResponseId) ?? null;
    const myRated = myRows.filter((r) => r.averageScore != null);
    const myAvg =
      myRated.length > 0
        ? Math.round(
            (myRated.reduce((acc, r) => acc + Number(r.averageScore ?? 0), 0) / myRated.length) * 10,
          ) / 10
        : null;
    const highRows = englishResponses.filter((r) => (r.averageScore ?? 0) >= 8);
    const leaderboard = Object.values(
      englishResponses.reduce<Record<string, {
        username: string;
        totalResponses: number;
        ratedResponses: number;
        sumScores: number;
        avg: number;
      }>>((acc, row) => {
        const key = String(row.username || `user-${row.userId}`);
        const cur = acc[key] ?? {
          username: String(row.username || "Unknown"),
          totalResponses: 0,
          ratedResponses: 0,
          sumScores: 0,
          avg: 0,
        };
        cur.totalResponses += 1;
        if (row.averageScore != null) {
          cur.ratedResponses += 1;
          cur.sumScores += Number(row.averageScore);
        }
        cur.avg = cur.ratedResponses > 0 ? cur.sumScores / cur.ratedResponses : 0;
        acc[key] = cur;
        return acc;
      }, {}),
    )
      .sort((a, b) => b.sumScores - a.sumScores || b.avg - a.avg)
      .slice(0, 10);

    return (
      <AppShell
        title={subject ? `${subject.name} Statistics` : "Statistics"}
        edgeToEdgeHeader
        edgeToEdgeHeaderClassName="px-0 sm:px-1 lg:px-2"
      >
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">English statistics</CardTitle>
              <CardDescription>
                View all your submitted responses with per-response ratings, your overall average, and the English leaderboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Submissions: {myRows.length}</Badge>
                <Badge variant="secondary">Overall average: {myAvg != null ? `${myAvg}/10` : "No ratings yet"}</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Your submitted passages/essays</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {myRows.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                  {myRows.map((r) => (
                    <div
                      key={`my-response-${r.id}`}
                      className="group relative aspect-square overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 z-[1]"
                        onClick={() => setOpenEnglishResponseId(r.id)}
                        aria-label={`Open your response ${r.id}`}
                      />
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-100" />
                      <div className="absolute inset-0 flex items-center justify-center p-1.5">
                        <div className="w-full rounded-sm border border-black/10 bg-white/60 p-1.5 backdrop-blur-sm">
                          <p className="line-clamp-3 whitespace-pre-wrap text-center text-[10px] leading-tight text-[#111827]/85 blur-[1.6px] select-none">
                            {(r.responseText || "Handwritten response").trim()}
                          </p>
                        </div>
                      </div>
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 border-b border-black/10 bg-white/88 px-1.5 py-1 backdrop-blur">
                        <span className="truncate text-[10px] font-semibold text-[#0f172a]">
                          {r.section ? `Section ${r.section}` : "Section —"}
                        </span>
                        <Badge variant="secondary" className="shrink-0 px-1 py-0 text-[9px]">
                          Avg: {r.averageScore != null ? `${r.averageScore}/10` : "—"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {!myRows.length ? <p className="text-sm text-muted-foreground">No submissions yet.</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">English leaderboard</CardTitle>
              <CardDescription>Ranked by total combined response score (sum of response averages).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!leaderboard.length ? (
                <p className="text-sm text-muted-foreground">No ranked responses yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Sum score</TableHead>
                      <TableHead className="text-right">Average</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaderboard.map((row, idx) => (
                      <TableRow
                        key={`${row.username}-${idx}`}
                        className={Number(user?.id) === Number(englishResponses.find((r) => r.username === row.username)?.userId) ? "bg-brand/8 font-medium" : ""}
                      >
                        <TableCell className="font-semibold">{idx + 1}</TableCell>
                        <TableCell>{row.username}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.sumScores.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.avg.toFixed(1)}/10</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">High-scoring responses</CardTitle>
              <CardDescription>Responses with average rating 8/10 or higher.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="secondary" onClick={() => setShowHighScoring((v) => !v)}>
                {showHighScoring ? "Hide high-scoring responses" : "View high-scoring responses"}
              </Button>
              {showHighScoring ? (
                <>
                  {highRows.map((r) => (
                    <div key={`high-${r.id}`} className="rounded-xl border border-black/10 bg-white/70 p-3">
                      <div className="text-xs text-muted-foreground">
                        @{r.username} • Avg {r.averageScore}/10
                      </div>
                      <p className="mt-2 text-sm whitespace-pre-wrap">{r.prompt}</p>
                      {r.responseText ? (
                        <p className="mt-2 text-sm whitespace-pre-wrap">{r.responseText.slice(0, 320)}{r.responseText.length > 320 ? "…" : ""}</p>
                      ) : null}
                    </div>
                  ))}
                  {!highRows.length ? (
                    <p className="text-sm text-muted-foreground">No responses above 8/10 yet.</p>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
        {openEnglishResponse ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpenEnglishResponseId(null)}>
            <div
              className="relative w-full max-w-3xl rounded-xl border border-black/10 bg-white p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-3 top-3 z-10 border-black/20 bg-white/95 hover:bg-white"
                onClick={() => setOpenEnglishResponseId(null)}
                aria-label="Close response"
              >
                <X className="size-4" />
              </Button>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#0f172a]">@{openEnglishResponse.username}</p>
                  <p className="text-xs text-muted-foreground">
                    Avg: {openEnglishResponse.averageScore != null ? `${openEnglishResponse.averageScore}/10` : "No ratings yet"}
                  </p>
                </div>
              </div>
              <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-black/10 bg-slate-50 p-4">
                <p className="mb-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#111827]">
                  {openEnglishResponse.prompt}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#111827]">
                  {openEnglishResponse.responseText || "No typed response text."}
                </p>
                {openEnglishResponse.imageUrls?.length ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {openEnglishResponse.imageUrls.map((u, i) => (
                      <img
                        key={`${openEnglishResponse.id}-${i}`}
                        src={u}
                        alt={`response-${openEnglishResponse.id}-${i + 1}`}
                        className="w-full rounded border border-black/10"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </AppShell>
    );
  }

  return (
    <AppShell
      title={subject ? `${subject.name} Statistics` : "Statistics"}
      edgeToEdgeHeader
      edgeToEdgeHeaderClassName="px-0 sm:px-1 lg:px-2"
    >
      <div className="space-y-8">
        {/* ---- Score hero ---- */}
        <Card className="paper-texture overflow-hidden">
          <div className="bg-gradient-to-br from-brand/10 via-transparent to-brand-light/5">
            <CardContent className="flex flex-col items-center py-10 text-center">
              <div className="mb-4 rounded-full bg-brand/10 p-4">
                <Trophy className="size-10 text-brand-dark" />
              </div>
              <h2 className="font-display text-[clamp(1.75rem,10vw,3rem)] font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                {correct} / {total}
              </h2>
              <p className="mt-1 text-[clamp(0.875rem,3.5vw,1.125rem)] text-muted-foreground sm:text-lg">
                correct ({percentage}%)
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
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
                  {stats.percentile != null ? (
                    <Badge
                      className={`text-sm px-3 py-1 ${getPercentileBadge(stats.percentile).className}`}
                    >
                      {getPercentileBadge(stats.percentile).label}
                    </Badge>
                  ) : (
                    <span className="font-display text-xl font-semibold text-muted-foreground">
                      —
                    </span>
                  )}
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

            {stats.rank == null && stats.percentile == null && (
              <p className="text-center text-sm text-muted-foreground">
                Rankings use your mark-weighted score (marks earned ÷ marks on questions you
                tried). You need at least {minRanked} scored questions in this period to be
                ranked.
              </p>
            )}

            {/* ---- Leaderboard ---- */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 font-display text-lg">
                      <TrendingUp className="size-5 text-brand-dark" />
                      Leaderboard
                    </CardTitle>
                    <CardDescription>
                      Top performers by mark-weighted % (min. {minRanked} questions). Only fully
                      correct responses count toward the “class fully correct” stats on each
                      question.
                    </CardDescription>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant={leaderboardRange === "week" ? "default" : "outline"}
                      className={
                        leaderboardRange === "week"
                          ? "bg-brand text-white hover:bg-brand-dark"
                          : ""
                      }
                      onClick={() => setLeaderboardRange("week")}
                    >
                      This Week
                    </Button>
                    <Button
                      size="sm"
                      variant={leaderboardRange === "all" ? "default" : "outline"}
                      className={
                        leaderboardRange === "all"
                          ? "bg-brand text-white hover:bg-brand-dark"
                          : ""
                      }
                      onClick={() => setLeaderboardRange("all")}
                    >
                      All Time
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Rank</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Mark %</TableHead>
                      <TableHead className="text-right">Marks earned / attempted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.leaderboard.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="py-10 text-center text-sm text-muted-foreground"
                        >
                          No leaderboard entries for this period yet. You need at least{" "}
                          {minRanked} scored questions in the window to rank; keep answering
                          to appear here.
                        </TableCell>
                      </TableRow>
                    ) : (
                      stats.leaderboard.map((entry, idx) => {
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
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ---- Topic breakdown ---- */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-lg">
                  <Star className="size-5 text-amber" />
                  Topic Breakdown
                </CardTitle>
                <CardDescription>
                  Your mark-weighted % vs. class on each topic, plus your percentile among
                  everyone who attempted that topic.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {displayTopicStats.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No topic attempts recorded for this period yet. Answer questions to build
                    this view.
                  </p>
                ) : (
                  <>
                {weakestTopicInfo &&
                  weakestTopicInfo.myCorrect !== null &&
                  weakestTopicInfo.myTotal > 0 && (
                    <div className="flex items-start gap-3 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-xs font-semibold uppercase tracking-wide text-danger">
                          Weakest topic
                        </div>
                        <div className="text-sm text-foreground">
                          <span className="font-semibold">{weakestTopicInfo.topic}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            —{" "}
                            {Math.round(
                              (weakestTopicInfo.myCorrect / weakestTopicInfo.myTotal) * 100,
                            )}
                            % correct ({weakestTopicInfo.myCorrect}/
                            {weakestTopicInfo.myTotal} marks)
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {displayTopicStats.map((topic) => {
                    const attempted =
                      topic.myTotal > 0 && topic.myCorrect !== null;
                    const yourPct =
                      attempted
                        ? Math.round(
                            ((topic.myCorrect ?? 0) / topic.myTotal) * 100
                          )
                        : 0;
                    const hasClassData =
                      canCompareClass && topic.totalAnswered > 0;
                    const classPct = hasClassData
                      ? Math.round((topic.correctCount / topic.totalAnswered) * 100)
                      : null;
                    const above =
                      hasClassData && classPct != null ? yourPct >= classPct : false;
                    const isWeak = attempted && yourPct < 50;
                    const isStrong = yourPct >= 80;
                    const tp = topic.topicPercentile;
                    const tpBadge =
                      tp != null ? getPercentileBadge(tp) : null;

                    return (
                      <div key={topic.topic} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">
                              {topic.topic}
                            </span>
                            {tpBadge && (
                              <Badge className={`text-xs ${tpBadge.className}`}>
                                Topic: {tpBadge.label}
                              </Badge>
                            )}
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
                                hasClassData
                                  ? above
                                    ? "text-success font-semibold"
                                    : "text-danger font-semibold"
                                  : "font-semibold text-foreground"
                              }
                            >
                              You: {yourPct}%
                            </span>
                            <span className="text-muted-foreground">
                              Class:{" "}
                              {hasClassData && classPct != null ? `${classPct}%` : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                hasClassData
                                  ? above
                                    ? "bg-success"
                                    : "bg-danger"
                                  : "bg-brand/50"
                              }`}
                              style={{ width: `${yourPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ---- Wrong answers ---- */}
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 font-display text-lg">
                      <ListX className="size-5 text-danger" />
                      Wrong answers
                      {(wrongQuestionRows.length > 0 || wrongCount > 0) && (
                        <Badge variant="secondary" className="font-normal">
                          {wrongQuestionRows.length > 0
                            ? wrongQuestionRows.length
                            : wrongCount}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Questions you answered incorrectly. Tap a row to open that question in
                      practice-only mode (not scored). Class % shows how others did on the same
                      question when available.
                    </CardDescription>
                  </div>
                  {wrongCount > 0 && (
                    <Button
                      variant="outline"
                      className="w-full shrink-0 gap-2 sm:w-auto"
                      onClick={() => navigate(`/quiz/${subjectId}/wrong`)}
                    >
                      <ListX className="size-4" />
                      Practice only
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {questionsLoading || questions.length === 0 ? (
                  <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    Loading questions…
                  </div>
                ) : wrongCount === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No incorrect answers saved yet. When you get a question wrong in practice, it
                    will appear here.
                  </p>
                ) : wrongQuestionRows.length === 0 && savedWrongCount > 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    You have {savedWrongCount} saved incorrect{" "}
                    {savedWrongCount === 1 ? "answer" : "answers"}, but{" "}
                    {savedWrongCount === 1 ? "it could" : "they could"} not be matched to the
                    current question bank. Open practice once for this subject, then return here
                    — or clear old progress from your browser if those questions were removed.
                  </p>
                ) : (
                  wrongQuestionRows.map((row, idx) => {
                    const qs = row.classStat;
                    const hasClassStat =
                      !!qs && canCompareClass && qs.totalAnswered > 0;
                    const pct =
                      qs?.fullyCorrectPercent != null
                        ? qs.fullyCorrectPercent
                        : qs && qs.totalAnswered > 0
                          ? Math.round((qs.correctCount / qs.totalAnswered) * 100)
                          : 0;
                    const topicLabel =
                      row.question.topic?.trim() || qs?.topic || "General";
                    const preview = row.question.question?.trim() || topicLabel;
                    const previewShort =
                      preview.length > 140 ? `${preview.slice(0, 140)}…` : preview;

                    return (
                      <div key={row.canonicalKey} className="space-y-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/quiz/${subjectId}/wrong?key=${encodeURIComponent(row.canonicalKey)}`,
                            )
                          }
                          className={cn(
                            "w-full min-w-0 rounded-xl border p-3 text-left transition-colors",
                            "border-danger/30 bg-danger/5 hover:bg-danger/10",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary" className="text-[10px]">
                                  {topicLabel}
                                </Badge>
                                <XCircle className="size-4 shrink-0 text-danger" />
                              </div>
                              <p className="mt-1.5 break-words text-sm leading-snug text-foreground [overflow-wrap:anywhere]">
                                <span className="font-semibold text-brand-dark">Q{idx + 1}. </span>
                                {previewShort}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                              {hasClassStat ? `${pct}% class correct` : "Class: —"}
                            </span>
                          </div>
                        </button>
                        {hasClassStat ? (
                          <Progress value={pct} />
                        ) : (
                          <div className="h-2 w-full rounded-full bg-muted/60" />
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
