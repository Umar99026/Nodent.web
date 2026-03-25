import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Derive a stable key from a question's index within the subject. */
function questionKey(subjectId: string, index: number): string {
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
/*  Custom questions from localStorage                                 */
/* ------------------------------------------------------------------ */

function getCustomQuestions(subjectId: string): Question[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.customQuestions);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, Question[]>;
    return parsed[subjectId] ?? [];
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
  const [topicFilter, setTopicFilter] = useState<string>("all");

  // Find subject
  const subject: Subject | undefined = useMemo(() => {
    return baseSubjects.find((s) => s.id === subjectId);
  }, [subjectId]);

  // Merge base questions with custom
  const questions: Question[] = useMemo(() => {
    if (!subjectId) return [];
    const base = subject?.quiz ?? [];
    const custom = getCustomQuestions(subjectId);
    return [...base, ...custom];
  }, [subject, subjectId]);

  const availableTopics = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => set.add((q.topic || "General").trim() || "General"));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    if (topicFilter === "all") return questions;
    return questions.filter((q) => (q.topic || "General") === topicFilter);
  }, [questions, topicFilter]);

  // Load persisted state on mount
  useEffect(() => {
    if (!user || !subjectId) return;

    const saved = loadPracticeState(user.id, subjectId);
    if (saved) {
      setCurrentIndex(saved.currentIndex);
      setAnswers(saved.answers);

      // If already completed, redirect to summary
      if (saved.completedAt) {
        navigate(`/quiz/${subjectId}/summary`, { replace: true });
        return;
      }
    }
    setInitialized(true);
  }, [user, subjectId, navigate]);

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
    ? questionKey(subjectId, currentIndex)
    : "";
  const isCurrentAnswered = currentQKey in answers;

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

  if (!initialized) {
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
        <QuizProgress current={answeredCount} total={filteredQuestions.length} />

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
                {questions.map((_q, i) => {
                  const qk = questionKey(subjectId, i);
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
                disabled={currentIndex === questions.length - 1}
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
    </AppShell>
  );
}
