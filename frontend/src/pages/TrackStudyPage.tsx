import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatSeconds } from "@/lib/utils";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/study/ProgressRing";
import { toast } from "sonner";
import {
  Play,
  Pause,
  RotateCcw,
  Clock,
  Zap,
  Target,
  Timer,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Persistence                                                        */
/* ------------------------------------------------------------------ */

interface TrackState {
  dailySeconds: number;
  goalMinutes: number;
  sessionMinutes: number;
  sessionsCompleted: number;
  remainingSeconds: number;
  isRunning: boolean;
}

function todayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function storageKey(userId: string): string {
  return STORAGE_KEYS.studyPrefix + userId + "_" + todayString();
}

const DEFAULTS: TrackState = {
  dailySeconds: 0,
  goalMinutes: 120,
  sessionMinutes: 25,
  sessionsCompleted: 0,
  remainingSeconds: 25 * 60,
  isRunning: false,
};

function loadState(userId: string): TrackState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as TrackState;
      // Always resume paused
      return { ...parsed, isRunning: false };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function persistState(userId: string, state: TrackState) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(state));
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function TrackStudyPage() {
  const { user } = useAuth();
  const userId = user ? String(user.id) : "guest";

  const [state, setState] = useState<TrackState>(() => loadState(userId));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    dailySeconds,
    goalMinutes,
    sessionMinutes,
    sessionsCompleted,
    remainingSeconds,
    isRunning,
  } = state;

  // Persist every state change
  useEffect(() => {
    persistState(userId, state);
  }, [state, userId]);

  // Timer tick
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.remainingSeconds <= 1) {
          toast.success("Session complete! Great work.");
          return {
            ...prev,
            remainingSeconds: prev.sessionMinutes * 60,
            isRunning: false,
            sessionsCompleted: prev.sessionsCompleted + 1,
            dailySeconds: prev.dailySeconds + prev.sessionMinutes * 60,
          };
        }
        return {
          ...prev,
          remainingSeconds: prev.remainingSeconds - 1,
        };
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Controls
  const handleStart = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const handlePause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const handleReset = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isRunning: false,
      remainingSeconds: prev.sessionMinutes * 60,
    }));
  }, []);

  const handleGoalChange = (value: string) => {
    const mins = Math.max(1, Math.min(480, Number(value) || 120));
    setState((prev) => ({ ...prev, goalMinutes: mins }));
  };

  const handleSessionChange = (value: string) => {
    const mins = Math.max(1, Math.min(120, Number(value) || 25));
    setState((prev) => ({
      ...prev,
      sessionMinutes: mins,
      remainingSeconds: prev.isRunning ? prev.remainingSeconds : mins * 60,
    }));
  };

  // Derived values
  const totalSessionSeconds = sessionMinutes * 60;
  const elapsed = totalSessionSeconds - remainingSeconds;
  const sessionProgress =
    totalSessionSeconds > 0 ? (elapsed / totalSessionSeconds) * 100 : 0;

  const goalProgress =
    goalMinutes > 0
      ? Math.min(100, (dailySeconds / (goalMinutes * 60)) * 100)
      : 0;

  const studiedMinutes = Math.floor(dailySeconds / 60);

  // SVG ring for timer
  const ringSize = 200;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (sessionProgress / 100) * circumference;

  return (
    <AppShell title="Track Study">
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        {/* LEFT — Timer Card */}
        <Card className="border-border bg-navy text-white">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 font-display text-xl text-white">
              <Timer className="size-5 text-brand-light" />
              Pomodoro Timer
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6 pt-4">
            {/* Circular progress ring with timer */}
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
                  stroke="#3797D3"
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
                <span className="font-display text-4xl font-bold tracking-tight">
                  {formatSeconds(remainingSeconds)}
                </span>
                <span className="mt-1 text-sm text-white/50">
                  Session {sessionsCompleted + 1}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {isRunning ? (
                <Button
                  onClick={handlePause}
                  variant="outline"
                  className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  <Pause className="size-4" />
                  Pause
                </Button>
              ) : (
                <Button
                  onClick={handleStart}
                  className="gap-2 bg-brand text-white hover:bg-brand-dark"
                >
                  <Play className="size-4" />
                  Start
                </Button>
              )}
              <Button
                onClick={handleReset}
                variant="outline"
                className="gap-2 border-white/20 bg-white/5 text-white hover:bg-white/10"
              >
                <RotateCcw className="size-4" />
                Reset
              </Button>
            </div>

            {/* Settings */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="track-goal"
                  className="text-sm text-white/60"
                >
                  Goal (min)
                </Label>
                <Input
                  id="track-goal"
                  type="number"
                  min={1}
                  max={480}
                  value={goalMinutes}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  disabled={isRunning}
                  className="w-20 border-white/20 bg-white/5 text-center text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="track-session"
                  className="text-sm text-white/60"
                >
                  Session (min)
                </Label>
                <Input
                  id="track-session"
                  type="number"
                  min={1}
                  max={120}
                  value={sessionMinutes}
                  onChange={(e) => handleSessionChange(e.target.value)}
                  disabled={isRunning}
                  className="w-20 border-white/20 bg-white/5 text-center text-white"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — Daily Stats */}
        <Card className="border-border bg-cream">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl text-brand-dark">
              Today's Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Goal ring */}
            <div className="flex justify-center py-2">
              <ProgressRing
                progress={goalProgress}
                size={130}
                strokeWidth={10}
                color="#3797D3"
              />
            </div>

            {/* Time Studied */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10">
                <Clock className="size-5 text-brand" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Time Studied</p>
                <p className="font-display text-lg font-semibold text-brand-dark">
                  {formatSeconds(dailySeconds)}
                </p>
              </div>
            </div>

            {/* Sessions */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10">
                <Zap className="size-5 text-success" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Sessions</p>
                <p className="font-display text-lg font-semibold text-brand-dark">
                  {sessionsCompleted}
                </p>
              </div>
            </div>

            {/* Daily Goal */}
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber/10">
                <Target className="size-5 text-amber" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Daily Goal</p>
                <p className="font-display text-lg font-semibold text-brand-dark">
                  {studiedMinutes} / {goalMinutes} min
                </p>
              </div>
            </div>

            {/* Goal progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Goal Progress</span>
                <span className="font-semibold text-brand">
                  {Math.round(goalProgress)}%
                </span>
              </div>
              <Progress value={goalProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
