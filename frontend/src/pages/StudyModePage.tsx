import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatSeconds } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

import { baseSubjects } from "@/lib/subjects";
import type { Question } from "@/lib/subjects";

/* ------------------------------------------------------------------ */
/*  Persistence helpers                                                */
/* ------------------------------------------------------------------ */

interface StudyModeState {
  index: number;
  durationMinutes: number;
  remainingSeconds: number;
  running: boolean;
}

function stateKey(userId: string, subjectId: string) {
  return STORAGE_KEYS.studyModePrefix + userId + "_" + subjectId;
}

function answersKey(subjectId: string, questionText: string) {
  return subjectId + "__" + questionText;
}

function loadStudyState(
  userId: string,
  subjectId: string,
  defaultDuration: number,
): StudyModeState {
  try {
    const raw = localStorage.getItem(stateKey(userId, subjectId));
    if (raw) return JSON.parse(raw) as StudyModeState;
  } catch {
    // ignore
  }
  return {
    index: 0,
    durationMinutes: defaultDuration,
    remainingSeconds: defaultDuration * 60,
    running: false,
  };
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

function loadAnswers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.studyModeAnswers);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    // ignore
  }
  return {};
}

function saveAnswer(subjectId: string, questionText: string, value: string) {
  const all = loadAnswers();
  all[answersKey(subjectId, questionText)] = value;
  try {
    localStorage.setItem(STORAGE_KEYS.studyModeAnswers, JSON.stringify(all));
  } catch {
    // ignore
  }
}

function getAnswer(subjectId: string, questionText: string): string {
  const all = loadAnswers();
  return all[answersKey(subjectId, questionText)] ?? "";
}

/* ------------------------------------------------------------------ */
/*  Type badge helper                                                  */
/* ------------------------------------------------------------------ */

function typeBadgeLabel(type: string): string {
  switch (type) {
    case "mcq":
      return "MCQ";
    case "short_answer":
      return "Short";
    case "written":
      return "Long";
    default:
      return type;
  }
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case "mcq":
      return "bg-brand/20 text-brand";
    case "short_answer":
      return "bg-amber/20 text-amber";
    case "written":
      return "bg-success/20 text-success";
    default:
      return "bg-white/20 text-white";
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_DURATION = 30;

export default function StudyModePage() {
  const { subjectId } = useParams<{ subjectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const subject = baseSubjects.find((s) => String(s.id) === subjectId);
  const questions: Question[] = subject?.quiz ?? [];
  const userId = user ? String(user.id) : "guest";

  // State
  const [studyState, setStudyState] = useState<StudyModeState>(() =>
    loadStudyState(userId, subjectId ?? "", DEFAULT_DURATION),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { index, durationMinutes, remainingSeconds, running } = studyState;

  // Persist state changes
  useEffect(() => {
    if (subjectId) {
      saveStudyState(userId, subjectId, studyState);
    }
  }, [studyState, userId, subjectId]);

  // Timer tick
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

  // Current question
  const currentQuestion = questions[index] ?? null;

  // Answer state for current question
  const [currentAnswer, setCurrentAnswer] = useState("");

  // Sync answer when question changes
  useEffect(() => {
    if (currentQuestion && subjectId) {
      setCurrentAnswer(getAnswer(subjectId, currentQuestion.question));
    }
  }, [index, currentQuestion, subjectId]);

  // Save answer on change
  const handleAnswerChange = useCallback(
    (value: string) => {
      setCurrentAnswer(value);
      if (currentQuestion && subjectId) {
        saveAnswer(subjectId, currentQuestion.question, value);
      }
    },
    [currentQuestion, subjectId],
  );

  // MCQ selection
  const handleOptionSelect = useCallback(
    (option: string) => {
      handleAnswerChange(option);
    },
    [handleAnswerChange],
  );

  // Navigation
  const goNext = () => {
    if (index < questions.length - 1) {
      setStudyState((prev) => ({ ...prev, index: prev.index + 1 }));
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setStudyState((prev) => ({ ...prev, index: prev.index - 1 }));
    }
  };

  // Timer controls
  const handleStart = () =>
    setStudyState((prev) => ({ ...prev, running: true }));
  const handlePause = () =>
    setStudyState((prev) => ({ ...prev, running: false }));
  const handleReset = () =>
    setStudyState((prev) => ({
      ...prev,
      running: false,
      remainingSeconds: prev.durationMinutes * 60,
    }));

  const handleDurationChange = (value: string) => {
    const mins = Math.max(10, Math.min(90, Number(value) || DEFAULT_DURATION));
    setStudyState((prev) => ({
      ...prev,
      durationMinutes: mins,
      remainingSeconds: prev.running ? prev.remainingSeconds : mins * 60,
    }));
  };

  const handleExit = () => {
    navigate(subjectId ? `/quiz/${subjectId}` : "/dashboard");
  };

  // Progress ring
  const totalSeconds = durationMinutes * 60;
  const elapsed = totalSeconds - remainingSeconds;
  const progress = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 0;
  const ringSize = 160;
  const strokeWidth = 8;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const subjectName = subject?.name ?? "Study";

  return (
    <AppShell title={`${subjectName} Study Mode`}>
      <div className="mx-auto max-w-4xl">
        {/* Dark study area */}
        <div className="rounded-2xl bg-navy p-6 text-white shadow-xl sm:p-8">
          {/* Timer row */}
          <div className="mb-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            {/* Timer ring */}
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
                  stroke="#10b981"
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

            {/* Timer controls & settings */}
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

              <Button
                onClick={handleExit}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-white/60 hover:text-white"
              >
                <LogOut className="size-4" />
                Exit Study Mode
              </Button>
            </div>
          </div>

          <Separator className="bg-white/10" />

          {/* Questions area */}
          {questions.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-xl text-white/60">
                No questions available for this subject.
              </p>
              <p className="mt-2 text-sm text-white/40">
                Questions will appear here once the subject data is loaded.
              </p>
            </div>
          ) : currentQuestion ? (
            <div className="mt-6 space-y-6">
              {/* Question header */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/50">
                  Question {index + 1} of {questions.length}
                </span>
                <Badge
                  className={`${typeBadgeColor(currentQuestion.type)} border-0`}
                >
                  {typeBadgeLabel(currentQuestion.type)}
                </Badge>
              </div>

              {/* Passage */}
              {currentQuestion.passage && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/40">
                    Passage
                  </p>
                  <p className="text-sm leading-relaxed text-white/80">
                    {currentQuestion.passage}
                  </p>
                </div>
              )}

              {/* Question text */}
              <p className="font-display text-lg font-semibold leading-relaxed">
                {currentQuestion.question}
              </p>

              {/* Answer area */}
              {currentQuestion.type === "mcq" &&
              currentQuestion.options?.length ? (
                <div className="space-y-2">
                  {currentQuestion.options.map((option, i) => (
                    <button
                      key={i}
                      onClick={() => handleOptionSelect(option)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition-colors ${
                        currentAnswer === option
                          ? "border-brand bg-brand/20 text-white"
                          : "border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10"
                      }`}
                    >
                      <span className="mr-2 font-semibold text-white/50">
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {option}
                    </button>
                  ))}
                </div>
              ) : currentQuestion.type === "long" ? (
                <Textarea
                  placeholder="Write your answer here..."
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  rows={6}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
                />
              ) : (
                <Textarea
                  placeholder="Type your answer..."
                  value={currentAnswer}
                  onChange={(e) => handleAnswerChange(e.target.value)}
                  rows={3}
                  className="border-white/20 bg-white/5 text-white placeholder:text-white/30"
                />
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
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
                  disabled={index === questions.length - 1}
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
    </AppShell>
  );
}
