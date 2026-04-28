import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  getRawCustomQuestionsForSubject,
  normalizeCustomQuestionsList,
} from "@/lib/practiceQuestions";
import { baseSubjects } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import {
  getStableQuestionIndex,
  normalizeAnswerMap,
  questionKeyStable,
  resolveAnswerKey,
} from "@/lib/practiceKeys";
import {
  randomizedQuestionsForSubject,
  getQuestionGroupKey,
} from "@/lib/quizShuffle";
import {
  buildGroupsFromOrderedFlat,
  getAllPartsInGroup,
  type QuestionStimulusGroup,
} from "@/lib/questionGroups";
import { stripQuestionHeadingFromPassage } from "@/lib/questionDisplay";
import { AppShell } from "@/components/layout/AppShell";
import { McqQuestion } from "@/components/quiz/McqQuestion";
import { ShortQuestion } from "@/components/quiz/ShortQuestion";
import { LongQuestion } from "@/components/quiz/LongQuestion";
import { CommentThread } from "@/components/quiz/CommentThread";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EnglishPracticePanel } from "@/pages/EnglishPracticePage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Practice state persistence                                         */
/* ------------------------------------------------------------------ */

interface PracticeState {
  currentIndex: number;
  /** questionKey -> isCorrect (null for long/written answers) */
  answers: Record<string, boolean | null>;
  completedAt?: string;
}

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
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const wrongPath = subjectId
    ? new RegExp(`^/quiz/${subjectId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/wrong/?$`)
    : null;
  const isWrongReview =
    (wrongPath?.test(location.pathname) ?? false) ||
    searchParams.get("review") === "wrong";
  const wrongOnlyKeyParam = searchParams.get("key");
  const { user } = useAuth();
  const { isInactive, resetInactivity } = useInactivity();

  const [showInactivityDialog, setShowInactivityDialog] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [initialized, setInitialized] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicFilter, setTopicFilter] = useState<string>("all");

  const [classByKey, setClassByKey] = useState<Record<string, number>>({});

  // Find subject (used for display metadata only)
  const subject: Subject | undefined = useMemo(() => {
    return baseSubjects.find((s) => s.id === subjectId);
  }, [subjectId]);
  const isMathSubject = /math/i.test(subject?.name ?? "");

  useEffect(() => {
    setInitialized(false);
  }, [subjectId, user?.id, isWrongReview]);

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
        const custom = normalizeCustomQuestionsList(raw);
        // If Sheets/admin questions are empty, fall back to built-in subject quiz.
        setQuestions(custom.length ? custom : (subject?.quiz ?? []));
      } catch {
        if (!cancelled) {
          const custom = getCustomQuestionsFromStorage(subjectId);
          setQuestions(custom.length ? custom : (subject?.quiz ?? []));
        }
      } finally {
        if (!cancelled) setQuestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subjectId, subject?.quiz]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => set.add((q.topic || "General").trim() || "General"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const randomizedQuestions = useMemo(() => {
    if (!subjectId || !user) return questions;
    return randomizedQuestionsForSubject(questions, user.id, subjectId);
  }, [questions, user, subjectId]);

  const wrongReviewGroups = useMemo((): QuestionStimulusGroup[] | null => {
    if (!isWrongReview || !user || !subjectId || questions.length === 0) {
      return null;
    }
    const subj = subjectId;
    const saved = loadPracticeState(user.id, subj);

    function buildWrongGroups(): QuestionStimulusGroup[] {
      if (!saved?.answers || Object.keys(saved.answers).length === 0) return [];
      const norm = normalizeAnswerMap(
        subj,
        saved.answers,
        questions,
        randomizedQuestions,
      );
      const seenGk = new Set<string>();
      const out: QuestionStimulusGroup[] = [];
      for (const [k, val] of Object.entries(norm)) {
        if (val !== false) continue;
        const r = resolveAnswerKey(subj, k, questions, randomizedQuestions);
        if (!r) continue;
        const gk = getQuestionGroupKey(r.q, questions);
        if (seenGk.has(gk)) continue;
        seenGk.add(gk);
        const parts = getAllPartsInGroup(gk, questions);
        const passage = parts.find((p) => p.passage?.trim())?.passage?.trim();
        out.push({ key: gk, passage, parts });
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
        const target = resolveAnswerKey(
          subj,
          dec,
          questions,
          randomizedQuestions,
        );
        if (!target) return [];
        const gk = getQuestionGroupKey(target.q, questions);
        const match = wrongs.find((g) => g.key === gk);
        if (match) return [match];
        const parts = getAllPartsInGroup(gk, questions);
        const passage = parts.find((p) => p.passage?.trim())?.passage?.trim();
        return [{ key: gk, passage, parts }];
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
    if (topicFilter === "all") return randomizedQuestions;
    return randomizedQuestions.filter(
      (q) => (q.topic || "General") === topicFilter,
    );
  }, [randomizedQuestions, topicFilter]);

  const allGroupsFlat = useMemo(
    () => buildGroupsFromOrderedFlat(topicFilteredFlat, questions),
    [topicFilteredFlat, questions],
  );

  /** Main quiz: stimulus groups where at least one part is not yet correct. */
  const activeGroups = useMemo(() => {
    if (!subjectId) return allGroupsFlat;
    return allGroupsFlat.filter((g) =>
      !g.parts.every((p) => {
        const qk = questionKeyStable(
          subjectId,
          p,
          Math.max(0, getStableQuestionIndex(questions, p)),
        );
        return answers[qk] === true;
      }),
    );
  }, [allGroupsFlat, answers, subjectId, questions]);

  const displayGroups: QuestionStimulusGroup[] = isWrongReview
    ? wrongReviewGroups ?? []
    : activeGroups;

  // Load persisted state after questions are known; normalize keys to stable bank indices.
  useEffect(() => {
    if (!user || !subjectId || questionsLoading) return;
    // If there are no questions, still mark initialized so we can render the
    // “No questions available” empty state instead of spinning forever.
    if (questions.length === 0) {
      setCurrentIndex(0);
      setAnswers({});
      setInitialized(true);
      return;
    }

    if (isWrongReview) {
      setCurrentIndex(0);
      setAnswers({});
      setInitialized(true);
      return;
    }

    const saved = loadPracticeState(user.id, subjectId);
    const groupCount = buildGroupsFromOrderedFlat(randomizedQuestions, questions).length;
    const maxIdx = Math.max(0, groupCount - 1);
    if (saved) {
      const norm = normalizeAnswerMap(
        subjectId,
        saved.answers,
        questions,
        randomizedQuestions,
      );
      if (JSON.stringify(norm) !== JSON.stringify(saved.answers)) {
        savePracticeState(user.id, subjectId, { ...saved, answers: norm });
      }
      setCurrentIndex(Math.min(saved.currentIndex, maxIdx));
      setAnswers(norm);
    }
    setInitialized(true);
  }, [
    user,
    subjectId,
    navigate,
    questionsLoading,
    questions,
    randomizedQuestions,
    isWrongReview,
  ]);

  // Show inactivity dialog
  useEffect(() => {
    if (isInactive) {
      setShowInactivityDialog(true);
    }
  }, [isInactive]);

  // Handle answer
  const handleAnswer = useCallback(
    (qKey: string, isCorrect: boolean | null, marks: number, topic: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [qKey]: isCorrect };
        if (user && subjectId) {
          savePracticeState(user.id, subjectId, {
            currentIndex,
            answers: next,
          });
        }
        return next;
      });

      if (!isWrongReview && isCorrect !== null) {
        apiFetch("/api/competition/answer", {
          method: "POST",
          body: JSON.stringify({
            subjectId,
            questionKey: qKey,
            isCorrect,
            marks,
            topic,
          }),
        }).catch(() => {
          // non-critical
        });
      }
    },
    [currentIndex, user, subjectId, isWrongReview]
  );

  // Navigation (index = stimulus group)
  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(displayGroups.length - 1, index));
    setCurrentIndex(clamped);
    if (user && subjectId && displayGroups.length > 0) {
      savePracticeState(user.id, subjectId, {
        currentIndex: clamped,
        answers,
      });
    }
  };

  useEffect(() => {
    setCurrentIndex((prev) =>
      Math.max(0, Math.min(displayGroups.length - 1, prev)),
    );
  }, [displayGroups.length]);

  const currentGroup = displayGroups[currentIndex] ?? null;

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
      <AppShell title="English Practice" subtitle="Select a book, write responses, and rate peers.">
        <EnglishPracticePanel />
      </AppShell>
    );
  }

  if (questions.length === 0) {
    return (
      <AppShell title={subject ? `${subject.name} Practice` : "Practice"}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-full bg-earth-paper p-4">
            <RotateCcw className="size-8 text-earth-muted" />
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
            Back to summary
          </Button>
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
              Go to summary
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
          <p className="rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
            Wrong-answer review: answers here are not sent to the competition and do not change your rank or marks.
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-end gap-3 sm:justify-start">
            {!isWrongReview && (
              <div className="w-56">
                <Select
                  value={topicFilter}
                  onValueChange={(val) => {
                    if (!val) return;
                    setTopicFilter(val);
                  }}
                >
                  <SelectTrigger className="h-10 bg-white border-black/10 text-[#0b0f19]">
                    <SelectValue placeholder="Topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All topics</SelectItem>
                    {availableTopics.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => navigate(`/study/${subjectId}`)}
              className="gap-2 border-transparent bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90"
            >
              <Clock className="size-4" />
              Study Mode
            </Button>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Left column: Question */}
          <div className="space-y-6">
            <Card className="paper-texture">
              <CardContent className="pt-2">
                {currentGroup && subjectId && (
                  <div className="max-h-[min(78vh,920px)] space-y-5 overflow-y-auto pr-1">
                    {stripQuestionHeadingFromPassage(currentGroup.passage) && (
                      <div className="rounded-xl border border-black/10 bg-white/60 p-4 text-sm leading-relaxed text-foreground shadow-sm">
                        {stripQuestionHeadingFromPassage(currentGroup.passage)}
                      </div>
                    )}
                    {currentGroup.parts.map((part) => {
                      const qk = questionKeyStable(
                        subjectId,
                        part,
                        Math.max(0, getStableQuestionIndex(questions, part)),
                      );
                      const ans = answers[qk];
                      const lockedCorrect = ans === true;
                      const hidePassage = Boolean(currentGroup.passage?.trim());
                      const partMarks =
                        typeof part.marks === "number"
                          ? part.marks
                          : part.type === "mcq"
                            ? 1
                            : 2;
                      const partTopic = part.topic ?? "General";
                      const partClass = classByKey[qk];
                      return (
                        <div
                          key={qk}
                          className={cn(
                            "rounded-xl border p-3 sm:p-4",
                            lockedCorrect
                              ? "border-success/35 bg-success/5"
                              : "border-black/10 bg-white/50",
                          )}
                        >
                          {part.type === "mcq" && (
                            <McqQuestion
                              question={part}
                              hidePassage={hidePassage}
                              lockedCorrect={lockedCorrect}
                              onAnswer={(correct) =>
                                handleAnswer(qk, correct, partMarks, partTopic)
                              }
                              disabled={lockedCorrect}
                              classFullyCorrectPercent={partClass ?? null}
                            />
                          )}
                          {part.type === "short" && (
                            <ShortQuestion
                              question={part}
                              hidePassage={hidePassage}
                              lockedCorrect={lockedCorrect}
                              onAnswer={(correct) =>
                                handleAnswer(qk, correct, partMarks, partTopic)
                              }
                              disabled={lockedCorrect}
                              classFullyCorrectPercent={partClass ?? null}
                            />
                          )}
                          {part.type === "long" && (
                            <LongQuestion
                              question={part}
                              subjectId={subjectId}
                              questionKey={qk}
                              hidePassage={hidePassage}
                              lockedCorrect={lockedCorrect}
                              onAnswer={(correct) =>
                                handleAnswer(qk, correct, partMarks, partTopic)
                              }
                              disabled={lockedCorrect}
                              classFullyCorrectPercent={partClass ?? null}
                              submitLabel={isMathSubject ? "Submit Answer" : "Save Answer"}
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
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0 || displayGroups.length === 0}
                className="gap-2 border-transparent bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>

              <Button
                variant="outline"
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex === displayGroups.length - 1}
                className="gap-2 border-transparent bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90 disabled:opacity-40"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Right column: Comments (desktop) — forum-style column, no extra card shell */}
          <div className="hidden lg:block">
            <div className="sticky top-6">
              {focusPart && (
                <CommentThread
                  key={focusQKey}
                  subjectId={subjectId}
                  questionKey={focusQKey}
                />
              )}
            </div>
          </div>
        </div>

        {/* Mobile comments (below question) */}
        <div className="lg:hidden">
          {focusPart && (
            <CommentThread
              key={`mobile-${focusQKey}`}
              subjectId={subjectId}
              questionKey={focusQKey}
            />
          )}
        </div>
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

