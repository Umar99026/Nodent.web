import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  getRawCustomQuestionsForSubject,
  normalizeCustomQuestionsList,
} from "@/lib/practiceQuestions";
import { baseSubjects } from "@/lib/subjects";
import type { Question, Subject } from "@/lib/subjects";
import { AppShell } from "@/components/layout/AppShell";
import { McqQuestion } from "@/components/quiz/McqQuestion";
import { ShortQuestion } from "@/components/quiz/ShortQuestion";
import { LongQuestion } from "@/components/quiz/LongQuestion";
import { QuizProgress } from "@/components/quiz/QuizProgress";
import { CommentThread } from "@/components/quiz/CommentThread";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Clock,
  Loader2,
  Send,
} from "lucide-react";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seedStr: string): T[] {
  const a = [...arr];
  const rand = mulberry32(hashSeed(seedStr));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seededShuffleGroups<T>(
  items: T[],
  seedStr: string,
  groupKey: (item: T) => string,
  sortWithinGroup?: (a: T, b: T) => number,
): T[] {
  // Preserve first-seen group order for stability, then shuffle groups.
  const groups: { key: string; items: T[] }[] = [];
  const idx = new Map<string, number>();
  for (const it of items) {
    const k = groupKey(it);
    const existing = idx.get(k);
    if (existing == null) {
      idx.set(k, groups.length);
      groups.push({ key: k, items: [it] });
    } else {
      groups[existing].items.push(it);
    }
  }
  for (const g of groups) {
    if (sortWithinGroup) g.items.sort(sortWithinGroup);
  }
  const shuffledGroups = seededShuffle(groups, seedStr);
  return shuffledGroups.flatMap((g) => g.items);
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Stable key: DB id when present (custom questions), else index in current list. */
function questionKey(
  subjectId: string,
  index: number,
  q: Question | null,
): string {
  if (q?.id != null) return `${subjectId}_qid_${q.id}`;
  return `${subjectId}_q${index}`;
}

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
  const { user } = useAuth();
  const { isInactive, resetInactivity } = useInactivity();

  const [showInactivityDialog, setShowInactivityDialog] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, boolean | null>>({});
  const [initialized, setInitialized] = useState(false);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topicFilter, setTopicFilter] = useState<string>("all");

  const [assignOpen, setAssignOpen] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friends, setFriends] = useState<
    { userId: number; username: string; email: string }[]
  >([]);
  const [assignFilter, setAssignFilter] = useState("");

  // Find subject (used for display metadata only)
  const subject: Subject | undefined = useMemo(() => {
    return baseSubjects.find((s) => s.id === subjectId);
  }, [subjectId]);

  useEffect(() => {
    setInitialized(false);
  }, [subjectId, user?.id]);

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
    // Stable per-user per-subject shuffle, but keep multi-part questions together.
    // Heuristic: questions sharing the exact same `passage` stay as a contiguous block.
    // If you later add an explicit `groupId`, it will take precedence automatically.
    return seededShuffleGroups(
      questions,
      `${user.id}:${subjectId}`,
      (q) => {
        const anyQ = q as unknown as { groupId?: unknown; passage?: unknown; id?: unknown };
        if (anyQ.groupId != null && String(anyQ.groupId).trim()) {
          return `gid:${String(anyQ.groupId).trim()}`;
        }
        if (typeof anyQ.passage === "string" && anyQ.passage.trim()) {
          return `passage:${anyQ.passage.trim()}`;
        }
        return `id:${String(anyQ.id ?? "") || JSON.stringify(q)}`;
      },
      (a, b) => {
        const aa = a as unknown as { id?: unknown };
        const bb = b as unknown as { id?: unknown };
        const ai = typeof aa.id === "number" ? aa.id : Number(aa.id);
        const bi = typeof bb.id === "number" ? bb.id : Number(bb.id);
        if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
        return 0;
      },
    );
  }, [questions, user, subjectId]);

  const filteredQuestions = useMemo(() => {
    if (topicFilter === "all") return randomizedQuestions;
    return randomizedQuestions.filter(
      (q) => (q.topic || "General") === topicFilter,
    );
  }, [randomizedQuestions, topicFilter]);

  // Load persisted state after questions are known (topic starts "all" → index matches full list).
  useEffect(() => {
    if (!user || !subjectId || questionsLoading) return;

    const saved = loadPracticeState(user.id, subjectId);
    const maxIdx = Math.max(0, questions.length - 1);
    if (saved) {
      setCurrentIndex(Math.min(saved.currentIndex, maxIdx));
      setAnswers(saved.answers);

      if (saved.completedAt) {
        navigate(`/quiz/${subjectId}/summary`, { replace: true });
        return;
      }
    }
    setInitialized(true);
  }, [user, subjectId, navigate, questionsLoading, questions.length]);

  // Show inactivity dialog
  useEffect(() => {
    if (isInactive) {
      setShowInactivityDialog(true);
    }
  }, [isInactive]);

  // Persist state on every answer change
  const persistState = useCallback(
    (index: number, ans: Record<string, boolean | null>) => {
      if (!user || !subjectId) return;
      savePracticeState(user.id, subjectId, {
        currentIndex: index,
        answers: ans,
      });
    },
    [user, subjectId]
  );

  // Handle answer
  const handleAnswer = useCallback(
    (qKey: string, isCorrect: boolean | null, marks: number, topic: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [qKey]: isCorrect };

        // Check completion
        const answeredCount = Object.keys(next).length;
        if (answeredCount >= filteredQuestions.length && filteredQuestions.length > 0) {
          // All answered — mark complete and redirect
          if (user && subjectId) {
            savePracticeState(user.id, subjectId, {
              currentIndex,
              answers: next,
              completedAt: new Date().toISOString(),
            });
          }
          toast.success("Quiz complete! Redirecting to summary...");
          setTimeout(() => {
            navigate(`/quiz/${subjectId}/summary`);
          }, 1200);
        } else {
          persistState(currentIndex, next);
        }

        return next;
      });

      // Send to competition API (fire-and-forget)
      if (isCorrect !== null) {
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
    [filteredQuestions.length, currentIndex, persistState, user, subjectId, navigate]
  );

  // Navigation
  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(filteredQuestions.length - 1, index));
    setCurrentIndex(clamped);
    persistState(clamped, answers);
  };

  useEffect(() => {
    // When switching topic sets, keep index in-range.
    setCurrentIndex((prev) => Math.max(0, Math.min(filteredQuestions.length - 1, prev)));
  }, [filteredQuestions.length]);

  const currentQuestion = filteredQuestions[currentIndex] ?? null;
  const currentMarks =
    currentQuestion && typeof currentQuestion.marks === "number"
      ? currentQuestion.marks
      : currentQuestion?.type === "mcq"
        ? 1
        : 2;
  const currentTopic = currentQuestion?.topic ?? "General";
  const answeredCount = Object.keys(answers).length;
  const currentQKey = subjectId
    ? questionKey(subjectId, currentIndex, currentQuestion)
    : "";
  const isCurrentAnswered = currentQKey in answers;

  const loadFriends = useCallback(async () => {
    setFriendsLoading(true);
    try {
      const r = await apiFetch<{ friends: { userId: number; username: string; email: string }[] }>(
        API_PATHS.friends.list,
      );
      setFriends(r.friends ?? []);
    } catch {
      setFriends([]);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  const assignToFriend = async (friendId: number) => {
    if (!subjectId || !currentQuestion) return;
    try {
      await apiFetch(API_PATHS.friends.assign(friendId), {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          questionKey: currentQKey,
          question: currentQuestion,
        }),
      });
      toast.success("Assigned!");
      setAssignOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign.");
    }
  };

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

  return (
    <AppShell title={subject ? `${subject.name} Practice` : "Practice"}>
      <div className="space-y-6">
        {/* Progress bar + Study Mode quick access */}
        <QuizProgress
          currentIndex={currentIndex}
          answeredCount={answeredCount}
          total={filteredQuestions.length}
        />

        <div className="h-px w-full bg-white/20" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center justify-end gap-3 sm:justify-start">
            {/* Topic filter (top-right like screenshot) */}
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
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setAssignOpen(true);
                void loadFriends();
              }}
              className="mr-3 gap-2 border-transparent bg-white text-[#0b0f19] hover:bg-white/90"
              disabled={!currentQuestion}
            >
              <Send className="size-4" />
              Assign
            </Button>
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
                {currentQuestion?.type === "mcq" && (
                  <McqQuestion
                    key={currentQKey}
                    question={currentQuestion}
                    onAnswer={(correct) =>
                      handleAnswer(
                        currentQKey,
                        correct,
                        currentMarks,
                        currentTopic,
                      )
                    }
                    disabled={isCurrentAnswered}
                  />
                )}
                {currentQuestion?.type === "short" && (
                  <ShortQuestion
                    key={currentQKey}
                    question={currentQuestion}
                    onAnswer={(correct) =>
                      handleAnswer(
                        currentQKey,
                        correct,
                        currentMarks,
                        currentTopic,
                      )
                    }
                    disabled={isCurrentAnswered}
                  />
                )}
                {currentQuestion?.type === "long" && (
                  <LongQuestion
                    key={currentQKey}
                    question={currentQuestion}
                    subjectId={subjectId}
                    questionKey={currentQKey}
                    onAnswer={(correct) =>
                      handleAnswer(
                        currentQKey,
                        correct,
                        currentMarks,
                        currentTopic,
                      )
                    }
                    disabled={isCurrentAnswered}
                  />
                )}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => goTo(currentIndex - 1)}
                disabled={currentIndex === 0}
                className="gap-2 border-transparent bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90 disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>

              {/* Question dots */}
              <div className="hidden flex-wrap justify-center gap-1.5 sm:flex">
                {filteredQuestions.map((q, i) => {
                  const qk = questionKey(subjectId, i, q);
                  return (
                    <button
                      key={qk}
                      onClick={() => goTo(i)}
                      className={`size-2.5 rounded-full transition-all ${
                        i === currentIndex
                          ? "scale-125 bg-brand ring-2 ring-brand/30"
                          : qk in answers
                            ? answers[qk] === true
                              ? "bg-success"
                              : answers[qk] === false
                                ? "bg-danger"
                                : "bg-brand/40"
                            : "bg-border"
                      }`}
                      title={`Question ${i + 1}`}
                    />
                  );
                })}
              </div>

              <Button
                variant="outline"
                onClick={() => goTo(currentIndex + 1)}
                disabled={currentIndex === filteredQuestions.length - 1}
                className="gap-2 border-transparent bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90 disabled:opacity-40"
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          {/* Right column: Comments (desktop) */}
          <div className="hidden lg:block">
            <Card className="sticky top-6">
              <CardContent>
                {currentQuestion && (
                  <CommentThread
                    key={currentQKey}
                    subjectId={subjectId}
                    questionKey={currentQKey}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Mobile comments (below question) */}
        <div className="lg:hidden">
          <Card>
            <CardContent>
              {currentQuestion && (
                <CommentThread
                  key={`mobile-${currentQKey}`}
                  subjectId={subjectId}
                  questionKey={currentQKey}
                />
              )}
            </CardContent>
          </Card>
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

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign this question</DialogTitle>
            <DialogDescription>
              Pick a friend to send them this exact question.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={assignFilter}
              onChange={(e) => setAssignFilter(e.target.value)}
              placeholder="Filter friends…"
            />

            {friendsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading friends…
              </div>
            ) : friends.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                You don&apos;t have any friends yet. Add them in Friends first.
              </div>
            ) : (
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {friends
                  .filter((f) => {
                    const q = assignFilter.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      f.username.toLowerCase().includes(q) ||
                      f.email.toLowerCase().includes(q)
                    );
                  })
                  .map((f) => (
                    <button
                      key={f.userId}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-black/10 bg-white px-3 py-2 text-left hover:bg-[#faf8f5]"
                      onClick={() => void assignToFriend(f.userId)}
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-black">
                          {f.username}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {f.email}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">Send</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

