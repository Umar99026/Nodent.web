import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { questionKeyStable, getStableQuestionIndex } from "@/lib/practiceKeys";
import { randomizedQuestionsForSubject } from "@/lib/quizShuffle";
import { buildGroupsFromOrderedFlat } from "@/lib/questionGroups";
import { McqQuestion } from "@/components/quiz/McqQuestion";
import { ShortQuestion } from "@/components/quiz/ShortQuestion";
import { LongQuestion } from "@/components/quiz/LongQuestion";
import { stripQuestionHeadingFromPassage } from "@/lib/questionDisplay";
import { formatSeconds, getQuestionTypeLabel } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StudyModeState {
  index: number;
  durationMinutes: number;
  remainingSeconds: number;
  running: boolean;
  /** If null/empty => unlimited questions. */
  questionGoal: number | null;
  /** One entry per completed stimulus group (not per part). */
  completedGroupKeys: string[];
  /** Per-part correctness for the session (keyed by stable questionKey). */
  attemptsByQuestionKey: Record<string, boolean | null>;
  /** Stable order for review UI. */
  attemptOrder: string[];
  /** True when a finite question goal was reached; cleared by Reset goal or full Reset. */
  goalFinished: boolean;
}

function normalizeStudyState(
  raw: unknown,
  defaultDuration: number,
): StudyModeState {
  const safeRaw =
    raw && typeof raw === "object" ? (raw as Partial<StudyModeState>) : {};
  const safeDuration = Math.max(
    10,
    Math.min(90, Number(safeRaw.durationMinutes) || defaultDuration),
  );
  const safeRemaining = Math.max(
    0,
    Number(safeRaw.remainingSeconds) || safeDuration * 60,
  );
  const safeIndex = Math.max(0, Number(safeRaw.index) || 0);
  const rawGoal = (safeRaw as any).questionGoal;
  const numericGoal = rawGoal == null || rawGoal === "" ? NaN : Number(rawGoal);
  const safeGoal =
    Number.isFinite(numericGoal) && numericGoal > 0
      ? Math.max(1, Math.min(300, Math.round(numericGoal)))
      : null;
  const safeGroupKeys = Array.isArray((safeRaw as Partial<StudyModeState>).completedGroupKeys)
    ? (safeRaw as Partial<StudyModeState>).completedGroupKeys!.filter(
        (k): k is string => typeof k === "string" && k.trim().length > 0,
      )
    : [];
  const safeAttempts =
    safeRaw && typeof (safeRaw as any).attemptsByQuestionKey === "object" && (safeRaw as any).attemptsByQuestionKey
      ? ((safeRaw as any).attemptsByQuestionKey as Record<string, boolean | null>)
      : {};
  const safeAttemptOrder = Array.isArray((safeRaw as any).attemptOrder)
    ? ((safeRaw as any).attemptOrder as unknown[]).map(String).filter((x) => x.trim().length > 0)
    : [];

  return {
    index: safeIndex,
    durationMinutes: safeDuration,
    remainingSeconds: safeRemaining,
    running: Boolean(safeRaw.running),
    questionGoal: safeGoal,
    completedGroupKeys: safeGroupKeys,
    attemptsByQuestionKey: safeAttempts,
    attemptOrder: safeAttemptOrder,
    goalFinished: Boolean((safeRaw as Partial<StudyModeState>).goalFinished),
  };
}

function stateKey(userId: string, subjectId: string) {
  return STORAGE_KEYS.studyModePrefix + userId + "_" + subjectId;
}

function loadStudyState(
  userId: string,
  subjectId: string,
  defaultDuration: number,
): StudyModeState {
  try {
    const raw = localStorage.getItem(stateKey(userId, subjectId));
    if (raw) return normalizeStudyState(JSON.parse(raw), defaultDuration);
  } catch {
    // ignore
  }
  return normalizeStudyState({}, defaultDuration);
}

function saveStudyState(
  userId: string,
  subjectId: string,
  state: StudyModeState,
) {
  try {
    localStorage.setItem(stateKey(userId, subjectId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

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

function typeBadgeLabel(type: Question["type"]): string {
  return getQuestionTypeLabel(type);
}

function typeBadgeColor(type: Question["type"]): string {
  switch (type) {
    case "mcq":
      return "bg-brand/20 text-brand";
    case "short":
      return "bg-amber/20 text-amber";
    case "long":
      return "bg-success/20 text-success";
    default:
      return "bg-white/20 text-white";
  }
}

const DEFAULT_DURATION = 30;

export default function StudyModePage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const subject: Subject | undefined = useMemo(
    () => baseSubjects.find((s) => String(s.id) === subjectId),
    [subjectId],
  );

  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);

  const userId = user ? String(user.id) : "guest";

  useEffect(() => {
    if (!subjectId) {
      setQuestions([]);
      setQuestionsLoading(false);
      return;
    }
    let cancelled = false;

    if (!user) {
      setQuestionsLoading(true);
      const custom = getCustomQuestionsFromStorage(subjectId);
      setQuestions(custom.length ? custom : (subject?.quiz ?? []));
      setQuestionsLoading(false);
      return;
    }

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

  const randomizedQuestions = useMemo(() => {
    if (!subjectId) return questions;
    const uid = user?.id ?? "guest";
    return randomizedQuestionsForSubject(questions, uid, subjectId);
  }, [questions, user, subjectId]);

  const studyGroups = useMemo(
    () => buildGroupsFromOrderedFlat(randomizedQuestions, questions),
    [randomizedQuestions, questions],
  );

  const [studyState, setStudyState] = useState<StudyModeState>(() =>
    loadStudyState(userId, subjectId ?? "", DEFAULT_DURATION),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { index, durationMinutes, remainingSeconds, running } = studyState;
  const completedCount = studyState.completedGroupKeys.length;
  const goalFinished = studyState.goalFinished;

  useEffect(() => {
    setStudyState((prev) =>
      loadStudyState(userId, subjectId ?? "", prev.durationMinutes),
    );
  }, [userId, subjectId]);

  useEffect(() => {
    setStudyState((prev) => ({
      ...prev,
      index: Math.max(0, Math.min(studyGroups.length - 1, prev.index)),
    }));
  }, [studyGroups.length]);

  useEffect(() => {
    if (subjectId) {
      saveStudyState(userId, subjectId, studyState);
    }
  }, [studyState, userId, subjectId]);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setStudyState((prev) => {
        if (prev.remainingSeconds <= 1) {
          toast.success("Time's up! Great study session.");
          return { ...prev, remainingSeconds: 0, running: false };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  const currentGroup = studyGroups[index] ?? null;
  const hidePassageForParts = Boolean(currentGroup?.passage?.trim());

  const goNext = () => {
    if (index < studyGroups.length - 1) {
      setStudyState((prev) => ({ ...prev, index: prev.index + 1 }));
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setStudyState((prev) => ({ ...prev, index: prev.index - 1 }));
    }
  };

  const handleStart = () =>
    setStudyState((prev) => ({ ...prev, running: true }));
  const handlePause = () =>
    setStudyState((prev) => ({ ...prev, running: false }));
  const handleReset = () =>
    setStudyState((prev) => ({
      ...prev,
      running: false,
      remainingSeconds: prev.durationMinutes * 60,
      completedGroupKeys: [],
      attemptsByQuestionKey: {},
      attemptOrder: [],
      goalFinished: false,
    }));

  const handleResetGoal = () =>
    setStudyState((prev) => ({
      ...prev,
      completedGroupKeys: [],
      attemptsByQuestionKey: {},
      attemptOrder: [],
      goalFinished: false,
    }));

  const handleDurationChange = (value: string) => {
    const mins = Math.max(10, Math.min(90, Number(value) || DEFAULT_DURATION));
    setStudyState((prev) => ({
      ...prev,
      durationMinutes: mins,
      remainingSeconds: prev.running ? prev.remainingSeconds : mins * 60,
    }));
  };

  const handleGoalChange = (value: string) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) {
      setStudyState((prev) => ({
        ...prev,
        questionGoal: null,
        goalFinished: false,
      }));
      return;
    }
    const parsed = Number(trimmed);
    const goal =
      Number.isFinite(parsed) && parsed > 0
        ? Math.max(1, Math.min(300, Math.round(parsed)))
        : null;
    setStudyState((prev) => {
      if (goal == null) return { ...prev, questionGoal: null, goalFinished: false };
      const alreadyMet = prev.completedGroupKeys.length >= goal;
      return {
        ...prev,
        questionGoal: goal,
        goalFinished: alreadyMet,
        ...(alreadyMet ? { running: false } : {}),
      };
    });
  };

  const markQuestionCompleted = useCallback((groupKey: string) => {
    if (!groupKey.trim()) return;
    setStudyState((prev) => {
      if (prev.goalFinished) return prev;
      if (prev.completedGroupKeys.includes(groupKey)) return prev;
      const nextCompleted = [...prev.completedGroupKeys, groupKey];
      const hitGoal =
        prev.questionGoal != null && nextCompleted.length >= prev.questionGoal;
      if (hitGoal) {
        toast.success("You’ve finished your question goal.");
        return {
          ...prev,
          completedGroupKeys: nextCompleted,
          goalFinished: true,
          running: false,
        };
      }
      return { ...prev, completedGroupKeys: nextCompleted };
    });
  }, []);

  const recordAttempt = useCallback((questionKey: string, correct: boolean | null) => {
    if (!questionKey.trim()) return;
    setStudyState((prev) => {
      const already = Object.prototype.hasOwnProperty.call(prev.attemptsByQuestionKey, questionKey);
      const nextOrder = already ? prev.attemptOrder : [...prev.attemptOrder, questionKey];
      return {
        ...prev,
        attemptsByQuestionKey: { ...prev.attemptsByQuestionKey, [questionKey]: correct },
        attemptOrder: nextOrder,
      };
    });
  }, []);

  const handleExit = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(subjectId ? `/quiz/${subjectId}` : "/dashboard");
  };

  const totalSeconds = durationMinutes * 60;
  const elapsed = totalSeconds - remainingSeconds;
  const progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0;
  const ringSize = 140;
  const strokeWidth = 9;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const renderPartCard = useCallback(
    (part: Question, groupKey: string, partsDisabled: boolean) => {
      if (!subjectId) return null;
      const qk = questionKeyStable(
        subjectId,
        part,
        Math.max(0, getStableQuestionIndex(questions, part)),
      );
      const hidePassage = hidePassageForParts;

      return (
        <div
          key={qk}
          className="rounded-xl border border-white/10 bg-white/[0.97] p-4 text-[#0b0f19] shadow-lg sm:p-5 [&_.text-muted-foreground]:text-neutral-600"
        >
          {part.type === "mcq" && (
            <McqQuestion
              question={part}
              hidePassage={hidePassage}
              lockedCorrect={false}
              onAnswer={(correct) => {
                recordAttempt(qk, correct);
                markQuestionCompleted(groupKey);
              }}
              disabled={partsDisabled}
              classFullyCorrectPercent={null}
            />
          )}
          {part.type === "short" && (
            <ShortQuestion
              question={part}
              hidePassage={hidePassage}
              lockedCorrect={false}
              onAnswer={(correct) => {
                recordAttempt(qk, correct);
                markQuestionCompleted(groupKey);
              }}
              disabled={partsDisabled}
              classFullyCorrectPercent={null}
            />
          )}
          {part.type === "long" && (
            <LongQuestion
              question={part}
              subjectId={subjectId}
              questionKey={qk}
              hidePassage={hidePassage}
              lockedCorrect={false}
              onAnswer={(correct) => {
                recordAttempt(qk, correct);
                markQuestionCompleted(groupKey);
              }}
              disabled={partsDisabled}
              classFullyCorrectPercent={null}
              practiceOnly
            />
          )}
        </div>
      );
    },
    [subjectId, questions, hidePassageForParts, markQuestionCompleted, recordAttempt],
  );

  return (
    <div className="fixed inset-0 z-50 bg-navy text-white">
      <div className="flex h-full flex-col p-3 sm:p-5">
        <div className="mb-3 flex items-start justify-start">
          <Button
            onClick={handleExit}
            variant="ghost"
            size="sm"
            className="gap-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white/5 p-4 shadow-xl sm:p-6 lg:p-8">
          <div className="mb-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
              <div className="relative flex items-center justify-center">
                <svg
                  width={ringSize}
                  height={ringSize}
                  viewBox={`0 0 ${ringSize} ${ringSize}`}
                  className="block"
                >
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    className="text-white/10"
                  />
                  <circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    fill="none"
                    stroke="#56abe6"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    className="transition-[stroke-dashoffset] duration-500 ease-out"
                    style={{
                      transform: "rotate(-90deg)",
                      transformOrigin: "50% 50%",
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-bold tracking-tight">
                    {formatSeconds(remainingSeconds)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2">
                  {running ? (
                    <Button
                      onClick={handlePause}
                      variant="outline"
                      size="sm"
                      className="gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10"
                    >
                      <Pause className="size-4" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStart}
                      size="sm"
                      className="gap-1.5 bg-brand text-white hover:bg-brand-dark"
                    >
                      <Play className="size-4" />
                      Start
                    </Button>
                  )}
                  <Button
                    onClick={handleReset}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    <RotateCcw className="size-4" />
                    Reset
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="study-duration"
                    className="text-xs text-white/60"
                  >
                    Duration (min)
                  </Label>
                  <Input
                    id="study-duration"
                    type="number"
                    min={10}
                    max={90}
                    value={durationMinutes}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    disabled={running}
                    className="w-16 border-white/20 bg-white/5 text-center text-sm text-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="study-goal" className="text-xs text-white/60">
                    Question goal
                  </Label>
                  <Input
                    id="study-goal"
                    type="number"
                    min={1}
                    max={300}
                    value={studyState.questionGoal ?? ""}
                    onChange={(e) => handleGoalChange(e.target.value)}
                    className="w-20 border-white/20 bg-white/5 text-center text-sm text-white"
                  />
                  {studyState.questionGoal != null ? (
                    <Badge className="border-white/20 bg-white/10 text-white">
                      {completedCount}/{studyState.questionGoal}
                    </Badge>
                  ) : (
                    <Badge className="border-white/20 bg-white/10 text-white">
                      Unlimited
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-white/10" />

            {questionsLoading ? (
              <div className="flex flex-1 items-center justify-center py-20">
                <Loader2 className="size-8 animate-spin text-brand" />
              </div>
            ) : questions.length === 0 ? (
              <div className="flex flex-1 items-center justify-center py-16 text-center">
                <div>
                <p className="font-display text-xl text-white/60">
                  No questions available for this subject.
                </p>
                <p className="mt-2 text-sm text-white/40">
                  Questions will appear here once the subject data is loaded.
                </p>
                </div>
              </div>
            ) : goalFinished && studyState.questionGoal != null ? (
              <div className="mt-8 flex min-h-0 flex-1 flex-col gap-6 px-4">
                <div className="text-center">
                  <p className="font-display text-xl font-semibold text-white">
                    Goal complete — summary
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    Review what you got right and wrong, then reset the goal if you want to keep going.
                  </p>
                </div>

                <div className="mx-auto w-full max-w-2xl space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm text-white/70">
                      Attempted: <span className="font-semibold text-white">{studyState.attemptOrder.length}</span>
                    </div>
                    <div className="text-sm text-white/70">
                      Correct:{" "}
                      <span className="font-semibold text-white">
                        {studyState.attemptOrder.filter((k) => studyState.attemptsByQuestionKey[k] === true).length}
                      </span>
                      {" · "}
                      Wrong:{" "}
                      <span className="font-semibold text-white">
                        {studyState.attemptOrder.filter((k) => studyState.attemptsByQuestionKey[k] === false).length}
                      </span>
                    </div>
                  </div>

                  {studyState.attemptOrder.length === 0 ? (
                    <p className="text-center text-sm text-white/60">
                      No attempts recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {studyState.attemptOrder.map((qk) => {
                        const res = studyState.attemptsByQuestionKey[qk];
                        return (
                          <div
                            key={qk}
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              res === true
                                ? "border-success/30 bg-success/10 text-white"
                                : res === false
                                  ? "border-danger/30 bg-danger/10 text-white"
                                  : "border-white/10 bg-white/5 text-white/80"
                            }`}
                          >
                            <span className="font-semibold">
                              {res === true ? "Correct" : res === false ? "Wrong" : "Saved"}
                            </span>
                            <span className="ml-2 break-all text-white/70">{qk}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setStudyState((prev) => ({ ...prev, goalFinished: false }))}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10"
                  >
                    Review questions
                  </Button>
                  <Button
                    type="button"
                    onClick={handleResetGoal}
                    size="sm"
                    className="gap-1.5 bg-brand text-white hover:bg-brand-dark"
                  >
                    <RotateCcw className="size-4" />
                    Reset goal
                  </Button>
                </div>
              </div>
            ) : currentGroup ? (
              <div className="mt-8 flex min-h-0 flex-1 flex-col space-y-8 overflow-auto">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">
                    Stimulus {index + 1} of {studyGroups.length}
                    {currentGroup.parts.length > 1 && (
                      <span className="text-white/40">
                        {" "}
                        · {currentGroup.parts.length} parts
                      </span>
                    )}
                  </span>
                  {currentGroup.parts.length === 1 && (
                    <Badge
                      className={`${typeBadgeColor(currentGroup.parts[0]!.type)} border-0`}
                    >
                      {typeBadgeLabel(currentGroup.parts[0]!.type)}
                    </Badge>
                  )}
                </div>

                {stripQuestionHeadingFromPassage(currentGroup.passage) && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/40">
                      Passage
                    </p>
                    <p className="whitespace-pre-wrap text-base leading-relaxed text-white/85">
                      {stripQuestionHeadingFromPassage(currentGroup.passage)}
                    </p>
                  </div>
                )}

                <div className="space-y-6">
                  {currentGroup.parts.map((part) =>
                    renderPartCard(part, currentGroup.key, false),
                  )}
                </div>

                <div className="mt-auto flex items-center justify-between pt-2">
                  <Button
                    onClick={goPrev}
                    disabled={index === 0}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </Button>
                  <Button
                    onClick={goNext}
                    disabled={index === studyGroups.length - 1}
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-white/20 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
        </div>
      </div>
    </div>
  );
}
