import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  loadPracticeBank,
  QUESTIONS_UPDATED_EVENT,
} from "@/lib/questionBankCache";
import {
  getRawCustomQuestionsForSubject,
  normalizeCustomQuestionsList,
  practiceQuestionsForSubject,
  canonicalPracticeTopic,
  questionMatchesPracticeTopic,
} from "@/lib/practiceQuestions";
import { subjectsForUser } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import { isAdminUser } from "@/lib/constants";
import {
  getStableQuestionIndex,
  normalizeAnswerMap,
  questionKeyStable,
  resolveQuestionForPractice,
} from "@/lib/practiceKeys";
import {
  randomizedQuestionsForSubject,
  getQuestionGroupKey,
} from "@/lib/quizShuffle";
import { generalMathsPracticeTopicOptions } from "@/lib/generalMathsAreaTopic";
import { methodsPracticeTopicOptions } from "@/lib/methodsAreaTopic";
import { specialistMathsPracticeTopicOptions } from "@/lib/specialistMathsAreaTopic";
import {
  buildGroupsFromOrderedFlat,
  getAllPartsInGroup,
  type QuestionStimulusGroup,
} from "@/lib/questionGroups";
import {
  collectStimulusFromParts,
  competitionMarksForQuestion,
  hasVisibleStimulus,
  stripQuestionHeadingFromPassage,
  type AnswerScoreDetail,
} from "@/lib/questionDisplay";
import { PassageBlock } from "@/components/quiz/QuestionStimulus";
import { AppShell } from "@/components/layout/AppShell";
import { McqQuestion } from "@/components/quiz/McqQuestion";
import { ShortQuestion } from "@/components/quiz/ShortQuestion";
import { LongQuestion } from "@/components/quiz/LongQuestion";
import { CommentThread } from "@/components/quiz/CommentThread";
import { AdminQuestionEditLink } from "@/components/admin/AdminQuestionEditLink";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { EnglishPracticePanel } from "@/pages/EnglishPracticePage";
import { TopicPerformanceSelect } from "@/components/practice/TopicPerformanceSelect";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useInactivity } from "@/hooks/useInactivity";
import { useHandwritingMode } from "@/context/HandwritingModeContext";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  BookOpen,
  Loader2,
  MessageSquare,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function uniqSortedTopics(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort(
    (a, b) => a.localeCompare(b),
  );
}

/* ------------------------------------------------------------------ */
/*  Practice state persistence                                         */
/* ------------------------------------------------------------------ */

interface PracticeState {
  currentIndex: number;
  /** questionKey -> result (true/false, null = submitted but not auto-scored) */
  answers: Record<string, boolean | null>;
  completedAt?: string;
}

type QuestionUiState = {
  selectedOption?: string | null;
  submitted?: boolean;
  isCorrect?: boolean;
  answer?: string;
  parts?: string[];
  response?: string;
  saved?: boolean;
  autoMarkResult?: boolean | null;
  dpHint?: number | null;
  partResults?: (boolean | null)[];
};

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
  state: PracticeState
) {
  localStorage.setItem(
    getPracticeStorageKey(userId, subjectId),
    JSON.stringify(state)
  );
}

/* ------------------------------------------------------------------ */
/*  Custom questions from localStorage (fallback)                       */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  QuizPage                                                           */
/* ------------------------------------------------------------------ */

export default function QuizPage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const wrongPath = subjectId
    ? new RegExp(`^/quiz/${subjectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/wrong/?$`)
    : null;
  const isWrongReview =
    (wrongPath?.test(location.pathname) ?? false) ||
    searchParams.get("review") === "wrong";
  const wrongOnlyKeyParam = searchParams.get("key");
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  /** Demo sandbox: keep the same question(s) available after every submit. */
  const isDemoSandbox = subjectId === "demo";
  /** Opt-in localhost preview only — `?mockFeedback=1` on /quiz/demo */
  const useDemoMockFeedback =
    import.meta.env.DEV && isDemoSandbox && searchParams.get("mockFeedback") === "1";
  const { setEnabled: setHandwritingMode } = useHandwritingMode();
  const { isInactive, resetInactivity } = useInactivity();

  useEffect(() => {
    if (isDemoSandbox && !isWrongReview) setHandwritingMode(true);
  }, [isDemoSandbox, isWrongReview, setHandwritingMode]);

  const [showInactivityDialog, setShowInactivityDialog] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [initialized, setInitialized] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [bankRefreshKey, setBankRefreshKey] = useState(0);
  const [questionUiState, setQuestionUiState] = useState<Record<string, QuestionUiState>>({});
  const initialTopicParam = String(searchParams.get("topic") ?? "").trim();
  const [topicFilter, setTopicFilter] = useState<string>(initialTopicParam || "all");
  const [pinnedGroupKey, setPinnedGroupKey] = useState<string | null>(null);
  const [answeredAtSessionStart, setAnsweredAtSessionStart] = useState<Set<string>>(new Set());

  const [classByKey, setClassByKey] = useState<Record<string, number>>({});
  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<PracticeState | null>(null);
  const bankInitializedRef = useRef<string | null>(null);

  // Find subject (used for display metadata only)
  const subject: Subject | undefined = useMemo(() => {
    const visible = subjectsForUser({ isAdmin });
    return visible.find((s) => s.id === subjectId);
  }, [subjectId, isAdmin]);
  // Demo subject is admin-only (guard direct URL access).
  useEffect(() => {
    if (String(subjectId) === "demo" && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [subjectId, isAdmin, navigate]);

  useEffect(() => {
    setInitialized(false);
    setPinnedGroupKey(null);
    setQuestionUiState({});
    setAnsweredAtSessionStart(new Set());
    bankInitializedRef.current = null;
  }, [subjectId, user?.id, isWrongReview]);

  const reloadBankAfterEdit = useCallback(
    (editedQuestionId: number | string) => {
      if (!subjectId || !user) return;
      const bank = loadPracticeBank(subjectId);
      setQuestions(bank);
      setBankRefreshKey((k) => k + 1);

      const edited = bank.find((q) => String(q.id) === String(editedQuestionId));
      if (!edited) return;

      const groupKey = getQuestionGroupKey(edited, bank);
      setPinnedGroupKey(groupKey);

      const rand = randomizedQuestionsForSubject(bank, user.id, subjectId);
      const filtered =
        topicFilter === "all"
          ? rand
          : rand.filter((q) => questionMatchesPracticeTopic(subjectId, q, topicFilter));
      const groups = buildGroupsFromOrderedFlat(filtered, bank);
      const isAnswered = (qk: string) =>
        answeredAtSessionStart.has(qk) || answers[qk] !== undefined;
      const visible = groups.filter(
        (g) =>
          g.key === groupKey ||
          !g.parts.every((p) => {
            const qk = questionKeyStable(
              subjectId,
              p,
              Math.max(0, getStableQuestionIndex(bank, p)),
            );
            return isAnswered(qk);
          }),
      );
      const idx = visible.findIndex((g) => g.key === groupKey);
      if (idx >= 0) setCurrentIndex(idx);
    },
    [subjectId, user, topicFilter, answers, answeredAtSessionStart],
  );

  // If the setup page passes ?topic=..., keep the UI in sync.
  useEffect(() => {
    const t = String(searchParams.get("topic") ?? "").trim();
    if (!t) return;
    setTopicFilter(t);
  }, [searchParams]);

  const schedulePracticeSave = useCallback(
    (next: PracticeState) => {
      if (!user || !subjectId) return;
      pendingSaveRef.current = next;
      if (saveTimerRef.current != null) return;
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const st = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (!st) return;
        savePracticeState(user.id, subjectId, st);
      }, 160);
    },
    [user, subjectId],
  );

  const updateQuestionUiState = useCallback(
    (qKey: string, patch: QuestionUiState) => {
      setQuestionUiState((prev) => {
        const curr = prev[qKey] ?? {};
        const nextForKey = { ...curr, ...patch };
        const same = Object.keys(nextForKey).every(
          (k) => (nextForKey as Record<string, unknown>)[k] === (curr as Record<string, unknown>)[k],
        );
        if (same) return prev;
        return { ...prev, [qKey]: nextForKey };
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current != null) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      pendingSaveRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!user || !subjectId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{
          questionStats?: { questionKey: string; fullyCorrectPercent?: number }[];
        }>(`/api/competition/${subjectId}/stats?range=all`);
        if (cancelled) return;
        const m: Record<string, number> = {};
        for (const q of data.questionStats ?? []) {
          if (q.questionKey != null && q.fullyCorrectPercent != null) {
            m[q.questionKey] = q.fullyCorrectPercent;
          }
        }
        setClassByKey(m);
      } catch {
        if (!cancelled) setClassByKey({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subjectId]);

  // Refresh custom questions from API so new admin questions show without re-login.
  useEffect(() => {
    if (!user || !subjectId) {
      setQuestions([]);
      setQuestionsLoading(false);
      return;
    }
    let cancelled = false;

    const cached = loadPracticeBank(subjectId);
    if (cached.length > 0) {
      setQuestions(cached);
      setQuestionsLoading(false);
    } else {
      setQuestionsLoading(true);
    }

    (async () => {
      try {
        const data = await apiFetch<{
          customQuestions?: Record<string, unknown[]>;
        }>(API_PATHS.bootstrap, { timeoutMs: BOOTSTRAP_FETCH_TIMEOUT_MS });
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
        setQuestions(
          practiceQuestionsForSubject(raw, subjectId),
        );
      } catch {
        if (!cancelled) {
          const stored = getCustomQuestionsFromStorage(subjectId);
          setQuestions(
            stored.length
              ? stored
              : loadPracticeBank(subjectId),
          );
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, subjectId]);

  useEffect(() => {
    if (!user || !subjectId) return;
    const onBankUpdated = () => {
      setQuestions(loadPracticeBank(subjectId));
      setBankRefreshKey((k) => k + 1);
    };
    window.addEventListener(QUESTIONS_UPDATED_EVENT, onBankUpdated);
    return () => window.removeEventListener(QUESTIONS_UPDATED_EVENT, onBankUpdated);
  }, [user, subjectId]);

  const availableTopics = useMemo(() => {
    if (subjectId === "general-maths" || subjectId === "demo") {
      return generalMathsPracticeTopicOptions().filter((t) => t !== "all");
    }
    if (subjectId === "specialist-maths") {
      return specialistMathsPracticeTopicOptions().filter((t) => t !== "all");
    }
    if (subjectId === "methods") {
      return methodsPracticeTopicOptions().filter((t) => t !== "all");
    }
    return uniqSortedTopics(
      questions.map((q) => (q.topic || "General").trim() || "General"),
    );
  }, [questions, subjectId]);

  useEffect(() => {
    // While questions are loading, `availableTopics` is empty; resetting here would
    // clear a valid ?topic= from the practice setup before the bank arrives.
    if (questionsLoading) return;
    if (topicFilter === "all") return;
    if (availableTopics.includes(topicFilter)) return;
    setTopicFilter("all");
  }, [availableTopics, topicFilter, questionsLoading]);

  const randomizedQuestions = useMemo(() => {
    if (!subjectId || !user) return questions;
    return randomizedQuestionsForSubject(questions, user.id, subjectId);
  }, [questions, user?.id, subjectId]);

  const wrongReviewGroups = useMemo((): QuestionStimulusGroup[] | null => {
    if (!isWrongReview || !user || !subjectId || questions.length === 0) {
      return null;
    }
    const subj = subjectId;
    const saved = loadPracticeState(user.id, subj);

    function buildWrongGroups(): QuestionStimulusGroup[] {
      if (!saved?.answers || Object.keys(saved.answers).length === 0) return [];
      const extra = getCustomQuestionsFromStorage(subj);
      const norm = normalizeAnswerMap(
        subj,
        saved.answers,
        questions,
        randomizedQuestions,
        extra,
      );
      const seenGk = new Set<string>();
      const out: QuestionStimulusGroup[] = [];
      const falseKeys = new Set<string>();
      for (const [k, val] of Object.entries(norm)) {
        if (val === false) falseKeys.add(k);
      }
      for (const [k, val] of Object.entries(saved.answers)) {
        if (val === false) falseKeys.add(k);
      }
      for (const k of falseKeys) {
        const r = resolveQuestionForPractice(
          subj,
          k,
          questions,
          randomizedQuestions,
          extra,
        );
        if (!r) continue;
        const gk = getQuestionGroupKey(r.q, questions);
        if (seenGk.has(gk)) continue;
        seenGk.add(gk);
        const parts = getAllPartsInGroup(gk, questions);
        const stimulus = collectStimulusFromParts(parts);
        out.push({
          key: gk,
          passage: stimulus.passage,
          imageUrls: stimulus.imageUrls.length ? stimulus.imageUrls : undefined,
          parts,
        });
      }
      const order = new Map<string, number>();
      randomizedQuestions.forEach((q, i) => {
        const gk = getQuestionGroupKey(q, questions);
        if (!order.has(gk)) order.set(gk, i);
      });
      out.sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
      return out;
    }

    if (wrongOnlyKeyParam) {
      try {
        const dec = decodeURIComponent(wrongOnlyKeyParam);
        const wrongs = buildWrongGroups();
        const target = resolveQuestionForPractice(
          subj,
          dec,
          questions,
          randomizedQuestions,
          getCustomQuestionsFromStorage(subj),
        );
        if (!target) return [];
        const gk = getQuestionGroupKey(target.q, questions);
        const match = wrongs.find((g) => g.key === gk);
        if (match) return [match];
        const parts = getAllPartsInGroup(gk, questions);
        const stimulus = collectStimulusFromParts(parts);
        return [
          {
            key: gk,
            passage: stimulus.passage,
            imageUrls: stimulus.imageUrls.length ? stimulus.imageUrls : undefined,
            parts,
          },
        ];
      } catch {
        return [];
      }
    }

    return buildWrongGroups();
  }, [
    isWrongReview,
    user,
    subjectId,
    questions,
    randomizedQuestions,
    wrongOnlyKeyParam,
  ]);

  const topicFilteredFlat = useMemo(() => {
    if (!subjectId || topicFilter === "all") return randomizedQuestions;
    return randomizedQuestions.filter((q) =>
      questionMatchesPracticeTopic(subjectId, q, topicFilter),
    );
  }, [randomizedQuestions, topicFilter, subjectId]);

  const allGroupsFlat = useMemo(
    () => buildGroupsFromOrderedFlat(topicFilteredFlat, questions),
    [topicFilteredFlat, questions],
  );

  /** Main quiz: once you answer a question, you should not see it again (except in wrong-answer review). */
  const activeGroups = useMemo(() => {
    if (!subjectId) return allGroupsFlat;
    if (isDemoSandbox) return allGroupsFlat;
    const isAnswered = (qk: string) =>
      answeredAtSessionStart.has(qk) || answers[qk] !== undefined;
    return allGroupsFlat.filter((g) =>
      g.key === pinnedGroupKey ||
      !g.parts.every((p) => {
        const qk = questionKeyStable(
          subjectId,
          p,
          Math.max(0, getStableQuestionIndex(questions, p)),
        );
        return isAnswered(qk);
      }),
    );
  }, [allGroupsFlat, subjectId, questions, pinnedGroupKey, answeredAtSessionStart, answers, isDemoSandbox]);

  const displayGroups: QuestionStimulusGroup[] = isWrongReview
    ? wrongReviewGroups ?? []
    : activeGroups;

  // Load persisted state once per subject session — not on every bank refresh.
  useEffect(() => {
    if (!user || !subjectId || questionsLoading) return;
    const sessionKey = `${user.id}:${subjectId}:${isWrongReview ? "wrong" : "quiz"}`;
    if (bankInitializedRef.current === sessionKey) return;

    // If there are no questions, still mark initialized so we can render the
    // “No questions available” empty state instead of spinning forever.
    if (questions.length === 0) {
      if (questionsLoading) return;
      setCurrentIndex(0);
      setAnswers({});
      setInitialized(true);
      bankInitializedRef.current = sessionKey;
      return;
    }

    if (isWrongReview) {
      setCurrentIndex(0);
      setAnswers({});
      setAnsweredAtSessionStart(new Set());
      setInitialized(true);
      bankInitializedRef.current = sessionKey;
      return;
    }

    if (isDemoSandbox) {
      setCurrentIndex(0);
      setAnswers({});
      setAnsweredAtSessionStart(new Set());
      setPinnedGroupKey(null);
      setInitialized(true);
      bankInitializedRef.current = sessionKey;
      return;
    }

    const saved = loadPracticeState(user.id, subjectId);
    const extra = getCustomQuestionsFromStorage(subjectId);
    const localNorm = normalizeAnswerMap(
      subjectId,
      saved?.answers ?? {},
      questions,
      randomizedQuestions,
      extra,
    );
    setCurrentIndex(0);
    setAnswers(localNorm);
    setAnsweredAtSessionStart(new Set(Object.keys(localNorm)));
    setPinnedGroupKey(null);
    setInitialized(true);
    bankInitializedRef.current = sessionKey;

    // Merge server attempts in the background — never block the quiz UI on this.
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiFetch<{
          myQuestionAttempts?: { questionKey: string; isCorrect: boolean }[];
        }>(`/api/competition/${subjectId}/stats?range=all`);
        if (cancelled) return;
        const merged: Record<string, boolean | null> = { ...localNorm };
        for (const row of data.myQuestionAttempts ?? []) {
          if (!row?.questionKey) continue;
          merged[row.questionKey] = row.isCorrect;
        }
        const norm = normalizeAnswerMap(
          subjectId,
          merged,
          questions,
          randomizedQuestions,
          extra,
        );
        if (JSON.stringify(norm) === JSON.stringify(localNorm)) return;
        setAnswers(norm);
        setAnsweredAtSessionStart(new Set(Object.keys(norm)));
        const base = saved ?? { currentIndex: 0, answers: {} };
        savePracticeState(user.id, subjectId, { ...base, answers: norm });
      } catch {
        // non-critical — local practice state still applies
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, subjectId, questionsLoading, isWrongReview, isDemoSandbox, questions.length]);

  // Show inactivity dialog
  useEffect(() => {
    if (isInactive) {
      setShowInactivityDialog(true);
    }
  }, [isInactive]);

  // Handle answer
  const handleAnswer = useCallback(
    (
      qKey: string,
      isCorrect: boolean | null,
      marks: number,
      topic: string,
      marksEarned?: number,
    ) => {
      const earned =
        marksEarned ?? (isCorrect ? marks : 0);
      if (!isWrongReview && !isDemoSandbox) {
        setAnswers((prev) => {
          const next = { ...prev, [qKey]: isCorrect };
          schedulePracticeSave({ currentIndex, answers: next });
          return next;
        });
      }

      if (!isWrongReview && subjectId) {
        const answeredGroup = allGroupsFlat.find((g) =>
          g.parts.some(
            (p) =>
              questionKeyStable(
                subjectId,
                p,
                Math.max(0, getStableQuestionIndex(questions, p)),
              ) === qKey,
          ),
        );
        if (answeredGroup) setPinnedGroupKey(answeredGroup.key);
      }

      if (!isWrongReview && isCorrect !== null) {
        apiFetch("/api/competition/answer", {
          method: "POST",
          body: JSON.stringify({
            subjectId,
            questionKey: qKey,
            isCorrect,
            marks,
            marksEarned: earned,
            topic,
          }),
        })
          .then(() => {
            // Let other pages (Dashboard scorecard) know points may have changed.
            window.dispatchEvent(new CustomEvent("nodent:scorecard-updated"));
          })
          .catch(() => {
            // non-critical
          });
      }
    },
    [currentIndex, subjectId, isWrongReview, isDemoSandbox, schedulePracticeSave, allGroupsFlat, questions]
  );

  // Navigation (index = stimulus group)
  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(displayGroups.length - 1, index));
    setCurrentIndex(clamped);
    setPinnedGroupKey(null);
    if (!isWrongReview && user && subjectId && displayGroups.length > 0) {
      schedulePracticeSave({ currentIndex: clamped, answers });
    }
  };

  // New topic filter → start at the first question in that topic (not the old index / end of list).
  useEffect(() => {
    setCurrentIndex(0);
    setPinnedGroupKey(null);
  }, [topicFilter]);

  useEffect(() => {
    setCurrentIndex((prev) => {
      if (displayGroups.length === 0) return 0;
      if (prev >= displayGroups.length) return 0;
      return prev;
    });
  }, [displayGroups.length]);

  const currentGroup = displayGroups[currentIndex] ?? null;
  const currentGroupStimulus = useMemo(
    () => (currentGroup ? collectStimulusFromParts(currentGroup.parts) : null),
    [currentGroup],
  );

  const focusPart =
    subjectId && currentGroup
      ? (currentGroup.parts.find((p) => {
          const qk = questionKeyStable(
            subjectId,
            p,
            Math.max(0, getStableQuestionIndex(questions, p)),
          );
          return answers[qk] !== true;
        }) ?? currentGroup.parts[0])
      : null;

  const focusQKey =
    subjectId && focusPart
      ? questionKeyStable(
          subjectId,
          focusPart,
          Math.max(0, getStableQuestionIndex(questions, focusPart)),
        )
      : "";

  const currentQuestionTopic = useMemo(() => {
    if (!subjectId || !focusPart) return null;
    return canonicalPracticeTopic(subjectId, focusPart);
  }, [subjectId, focusPart]);

  // Handle dismissing inactivity
  const handleDismissInactivity = () => {
    setShowInactivityDialog(false);
    resetInactivity();
  };

  // -- Renders --

  if (!subjectId) {
    return (
      <AppShell title="Practice">
        <div className="flex flex-col items-center justify-center py-20">
          <h2 className="font-display text-xl text-foreground">
            Subject not found
          </h2>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  if (!initialized || questionsLoading) {
    return (
      <AppShell title="Loading...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-brand" />
        </div>
      </AppShell>
    );
  }

  if (subjectId === "english") {
    return (
      <AppShell
        title="English Practice"
        subtitle="Select a book, write responses, and rate peers."
        edgeToEdgeHeader
        edgeToEdgeMain
      >
        <EnglishPracticePanel />
      </AppShell>
    );
  }

  if (questions.length === 0) {
    return (
      <AppShell title={subject ? `${subject.name} Practice` : "Practice"}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-black/[0.04] p-4">
            <RotateCcw className="size-8 text-muted-foreground" />
          </div>
          <h2 className="mt-4 font-display text-xl text-foreground">
            No questions available
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This subject doesn&apos;t have any questions yet.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate("/")}
          >
            Back to Dashboard
          </Button>
        </div>
      </AppShell>
    );
  }

  if (isWrongReview && (wrongReviewGroups?.length ?? 0) === 0) {
    return (
      <AppShell title={subject ? `${subject.name} Practice` : "Practice"}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <h2 className="font-display text-xl text-foreground">
            Nothing to review
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            No incorrect answers are saved for this subject yet. As you practise, wrong answers are
            added here automatically. Use the same device and account so progress stays in sync.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate(`/quiz/${subjectId}/summary`)}
          >
            Back to statistics
          </Button>
        </div>
      </AppShell>
    );
  }

  if (
    !isWrongReview &&
    topicFilter !== "all" &&
    topicFilteredFlat.length === 0 &&
    questions.length > 0
  ) {
    return (
      <AppShell title={subject ? `${subject.name} Practice` : "Practice"}>
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h2 className="font-display text-xl text-foreground">No questions for this topic</h2>
          <p className="text-sm text-muted-foreground">
            There are no practice questions tagged to <strong>{topicFilter}</strong> yet. Choose
            another topic or &quot;All topics&quot;, or add questions in Admin for this topic.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setTopicFilter("all")}>
              All topics
            </Button>
            <Button onClick={() => navigate(`/practice/${subjectId}`)}>Practice setup</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!isWrongReview && activeGroups.length === 0 && questions.length > 0) {
    return (
      <AppShell title={subject ? `${subject.name} Revision` : "Revision"}>
        <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
          <h2 className="font-display text-xl text-foreground">You&apos;re caught up</h2>
          <p className="text-sm text-muted-foreground">
            Every question in{" "}
            {topicFilter === "all" ? "this subject" : `“${topicFilter}”`} is marked correct. Open any
            question from the summary to revisit it, or switch topic / choose &quot;All topics&quot;
            to keep revising.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(`/quiz/${subjectId}/summary`)}>
              Go to statistics
            </Button>
            <Button onClick={() => navigate("/")}>Dashboard</Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={subject ? `${subject.name} Practice` : "Practice"}
      edgeToEdgeHeader
    >
      <div className="space-y-6">
        {isWrongReview && (
          <p className="rounded-lg border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-950">
            Wrong-answer review: answers here are not sent to the competition and do not change your rank or marks.
          </p>
        )}
        {isDemoSandbox && !isWrongReview && (
          <p className="rounded-lg border border-brand/25 bg-brand/5 px-4 py-3 text-sm text-foreground">
            {useDemoMockFeedback ? (
              <>
                Maths sandbox (mock preview) — preloaded wrong-answer feedback, no OpenAI. Remove{" "}
                <code className="rounded bg-black/5 px-1">?mockFeedback=1</code> from the URL for
                live AI marking.
              </>
            ) : (
              <>
                Maths sandbox — draw your working on the pad (one image per part). AI reads your
                handwriting, shows what it interpreted, and marks with detailed formatted feedback.
                Submit as many times as you like.
              </>
            )}
          </p>
        )}

        <div className="practice-toolbar">
          <div className="flex min-w-0 flex-1 items-center">
            {!isWrongReview && (
              <div className="w-fit min-w-0">
                <TopicPerformanceSelect
                  subjectId={subjectId}
                  value={topicFilter}
                  onValueChange={(val) => {
                    setTopicFilter(val);
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev);
                        if (val === "all") next.delete("topic");
                        else next.set("topic", val);
                        return next;
                      },
                      { replace: true },
                    );
                  }}
                  topics={availableTopics}
                  includeAllOption
                  allOptionLabel="All topics"
                  placeholder="Topic"
                />
              </div>
            )}
            {isWrongReview ? (
              <span className="text-sm font-medium text-white/80">Wrong-answer review</span>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant={discussionOpen ? "accent" : "outline"}
              onClick={() => setDiscussionOpen((open) => !open)}
              className="gap-2"
              aria-expanded={discussionOpen}
            >
              <MessageSquare className="size-4" />
              <span className="hidden sm:inline">
                {discussionOpen ? "Hide discussion" : "Discussion"}
              </span>
              <span className="sm:hidden">{discussionOpen ? "Hide" : "Chat"}</span>
            </Button>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  variant="accent"
                  disabled={!currentQuestionTopic}
                  onClick={() => {
                    if (!subjectId || !currentQuestionTopic) return;
                    navigate(
                      `/practice/${subjectId}?topic=${encodeURIComponent(currentQuestionTopic)}`,
                    );
                  }}
                  className="gap-2 disabled:opacity-50"
                >
                  <BookOpen className="size-4" />
                  Content
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                {currentQuestionTopic
                  ? `Topic overview: ${currentQuestionTopic}`
                  : "Topic overview for this question"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Question + optional discussion sidebar */}
        <div
          className={cn(
            "grid gap-6 transition-[grid-template-columns] duration-300 ease-out",
            discussionOpen && "lg:grid-cols-[minmax(0,1fr)_340px]",
          )}
        >
          {/* Question column — full width until discussion opens */}
          <div className="min-w-0 space-y-6">
            <Card className="practice-card">
              <div className="practice-card-accent" aria-hidden>
                <div className="practice-card-accent-black" />
                <div className="practice-card-accent-pill" />
              </div>
              <CardContent className="bg-[#f3f4f6]/25 p-5 sm:p-6">
                {currentGroup && subjectId && (
                  <div className="space-y-5">
                    {currentGroupStimulus && hasVisibleStimulus(currentGroupStimulus) && (
                      <PassageBlock
                        passage={stripQuestionHeadingFromPassage(currentGroupStimulus.passage)}
                        imageUrls={currentGroupStimulus.imageUrls}
                      />
                    )}
                    {currentGroup.parts.map((part) => {
                      const qk = questionKeyStable(
                        subjectId,
                        part,
                        Math.max(0, getStableQuestionIndex(questions, part)),
                      );
                      const ans = answers[qk];
                      const alreadySubmitted = ans !== undefined;
                      const markedCorrect = ans === true;
                      const lockAfterSubmit =
                        !isWrongReview && !isDemoSandbox && alreadySubmitted;
                      const sandboxRepeat = isDemoSandbox;
                      const hidePassage = Boolean(
                        currentGroupStimulus && hasVisibleStimulus(currentGroupStimulus),
                      );
                      const partMarks = competitionMarksForQuestion(part);
                      const partTopic = part.topic ?? "General";
                      const partClass = classByKey[qk];
                      return (
                        <div
                          key={`${qk}-${bankRefreshKey}`}
                          className={cn(
                            "rounded-xl border p-3 sm:p-4",
                            markedCorrect
                              ? "border-success/35 bg-success/5"
                              : "border-black/10 border-l-4 border-l-brand-deep bg-white",
                          )}
                        >
                          {isAdmin && part.id ? (
                            <div className="mb-3 flex justify-end">
                              <AdminQuestionEditLink
                                question={part}
                                subjectId={subjectId}
                                onSaved={() => {
                                  if (part.id != null) {
                                    reloadBankAfterEdit(part.id);
                                  }
                                }}
                              />
                            </div>
                          ) : null}
                          {part.type === "mcq" && (
                            <McqQuestion
                              question={part}
                              hidePassage={hidePassage}
                              lockedCorrect={false}
                              onAnswer={(correct) =>
                                handleAnswer(
                                  qk,
                                  correct,
                                  partMarks,
                                  partTopic,
                                  correct ? partMarks : 0,
                                )
                              }
                              disabled={lockAfterSubmit}
                              allowRetry={isWrongReview || sandboxRepeat}
                              repeatSandbox={sandboxRepeat}
                              classFullyCorrectPercent={partClass ?? null}
                              persistedState={questionUiState[qk]}
                              onStateChange={(state) => updateQuestionUiState(qk, state)}
                            />
                          )}
                          {part.type === "short" && (
                            <ShortQuestion
                              question={part}
                              subjectId={subjectId}
                              questionKey={qk}
                              hidePassage={hidePassage}
                              lockedCorrect={false}
                              questionDisplayNumber={currentIndex + 1}
                              onAnswer={(correct, detail?: AnswerScoreDetail) =>
                                handleAnswer(
                                  qk,
                                  correct,
                                  detail?.marksTotal ?? partMarks,
                                  partTopic,
                                  detail?.marksEarned,
                                )
                              }
                              disabled={lockAfterSubmit}
                              allowRetry={isWrongReview || sandboxRepeat}
                              repeatSandbox={sandboxRepeat}
                              practiceOnly={isWrongReview || sandboxRepeat}
                              devMockMarking={useDemoMockFeedback}
                              classFullyCorrectPercent={partClass ?? null}
                              persistedState={questionUiState[qk]}
                              onStateChange={(state) => updateQuestionUiState(qk, state)}
                            />
                          )}
                          {part.type === "long" && (
                            <LongQuestion
                              question={part}
                              subjectId={subjectId}
                              questionKey={qk}
                              hidePassage={hidePassage}
                              lockedCorrect={false}
                              questionDisplayNumber={currentIndex + 1}
                              onAnswer={(correct, detail?: AnswerScoreDetail) =>
                                handleAnswer(
                                  qk,
                                  correct,
                                  detail?.marksTotal ?? partMarks,
                                  partTopic,
                                  detail?.marksEarned,
                                )
                              }
                              disabled={lockAfterSubmit}
                              practiceOnly={isWrongReview || sandboxRepeat}
                              repeatSandbox={sandboxRepeat}
                              classFullyCorrectPercent={partClass ?? null}
                              persistedState={questionUiState[qk]}
                              onStateChange={(state) => updateQuestionUiState(qk, state)}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0 || displayGroups.length === 0}
                className="h-11 min-w-[5.5rem] gap-1.5 border-transparent bg-[#0b0f19] px-3 text-white hover:bg-[#0b0f19]/90 disabled:opacity-40 sm:min-w-0 sm:gap-2 sm:px-4"
              >
                <ChevronLeft className="size-4 shrink-0" />
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex === displayGroups.length - 1}
                className="h-11 min-w-[5.5rem] gap-1.5 border-transparent bg-[#0b0f19] px-3 text-white hover:bg-[#0b0f19]/90 disabled:opacity-40 sm:min-w-0 sm:gap-2 sm:px-4"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
                <ChevronRight className="size-4 shrink-0" />
              </Button>
            </div>
          </div>

          {/* Discussion sidebar (desktop) */}
          {discussionOpen ? (
            <div className="hidden min-w-0 lg:block">
              <div className="sticky top-[calc(3.5rem+0.75rem)]">
                {focusPart && subjectId ? (
                  <CommentThread
                    key={focusQKey}
                    subjectId={subjectId}
                    questionKey={focusQKey}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* Discussion drawer (mobile / tablet) */}
        {discussionOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/45 lg:hidden"
              aria-label="Close discussion"
              onClick={() => setDiscussionOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 z-50 flex w-[min(340px,100vw)] flex-col border-l border-black/10 bg-[#f3f4f6] shadow-2xl lg:hidden">
              <div className="flex shrink-0 items-center justify-between border-b border-black/10 bg-white px-4 py-3">
                <p className="font-display text-sm font-semibold text-[#0b0f19]">Discussion</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setDiscussionOpen(false)}
                  aria-label="Close discussion"
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {focusPart && subjectId ? (
                  <CommentThread
                    key={`mobile-${focusQKey}`}
                    subjectId={subjectId}
                    questionKey={focusQKey}
                  />
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Inactivity dialog */}
      <AlertDialog
        open={showInactivityDialog}
        onOpenChange={setShowInactivityDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Clock className="size-5 text-amber" />
              Still there?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve been inactive for a while. Would you like to continue
              practicing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => navigate("/")}>
              Leave
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDismissInactivity}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppShell>
  );
}

