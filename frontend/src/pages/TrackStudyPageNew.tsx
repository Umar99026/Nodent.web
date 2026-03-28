import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStudyTimer } from "@/context/StudyTimerContext";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatSeconds, localDateISO, mergeSecondsBySubject } from "@/lib/utils";
import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";
import { AppShell } from "@/components/layout/AppShell";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Clock, Coffee, Flame, Target, Play, Pause, Maximize2, X } from "lucide-react";

type RangeMode = "day" | "week";

function dateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function studyStorageKey(userId: string, date: string): string {
  return STORAGE_KEYS.studyPrefix + userId + "_" + date;
}

function loadDay(userId: string, date: string): any | null {
  try {
    const raw = localStorage.getItem(studyStorageKey(userId, date));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadAnsweredCount(userId: string, subjectId: string): number {
  try {
    const raw = localStorage.getItem(
      `${STORAGE_KEYS.practiceStatePrefix}${userId}_${subjectId}`,
    );
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { answers?: Record<string, boolean | null> };
    const answers = parsed?.answers ?? {};
    return Object.keys(answers).length;
  } catch {
    return 0;
  }
}

export default function TrackStudyPageNew() {
  const { user } = useAuth();
  const userId = user ? String(user.id) : null;
  const [studyMergeRev, setStudyMergeRev] = useState(0);
  useEffect(() => {
    const h = () => setStudyMergeRev((x) => x + 1);
    window.addEventListener("nodent-study-merged", h);
    return () => window.removeEventListener("nodent-study-merged", h);
  }, []);
  const {
    state,
    setBreakMinutes,
    setGoalMinutes,
    setSessionMinutes,
    selectSubject,
    setRunningSession,
  } = useStudyTimer();

  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [timerFullscreen, setTimerFullscreen] = useState(false);

  const activeSubject: Subject | undefined = useMemo(() => {
    if (!state.activeSubjectId) return undefined;
    return baseSubjects.find((s) => s.id === state.activeSubjectId);
  }, [state.activeSubjectId]);

  const phaseLabel = state.phase === "break" ? "Break" : "Study";
  const totalSeconds =
    state.phase === "break" ? state.breakMinutes * 60 : state.sessionMinutes * 60;

  const elapsed = Math.max(0, totalSeconds - state.remainingSeconds);
  const progressPct =
    totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0;

  const ringSize = 280;
  const strokeWidth = 14;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPct / 100) * circumference;

  const goalPct = state.goalMinutes > 0 ? state.dailySeconds / (state.goalMinutes * 60) : 0;

  const daySubjectRows = useMemo(() => {
    const entries = Object.entries(state.dailySecondsBySubject);
    const rows = entries
      .map(([subjectId, seconds]) => ({
        subjectId,
        subjectName:
          subjectId === "unassigned"
            ? "Other"
            : (baseSubjects.find((s) => s.id === subjectId)?.name ?? subjectId),
        questionsAnswered: userId ? loadAnsweredCount(userId, subjectId) : 0,
        seconds: Math.max(0, Math.floor(Number(seconds) || 0)),
      }))
      .filter((r) => r.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);
    return rows;
  }, [state.dailySecondsBySubject, userId]);

  const activeSubjectIdOrFirst = state.activeSubjectId ?? baseSubjects[0]?.id ?? "";

  const todayKey = localDateISO();

  const weekData = useMemo(() => {
    if (!userId) return null;

    const today = new Date();
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push(dateString(d));
    }

    const perDay = days.map((d) => {
      const day = loadDay(userId, d);
      let seconds = typeof day?.dailySeconds === "number" ? day.dailySeconds : 0;
      if (d === todayKey) {
        seconds = Math.max(seconds, state.dailySeconds);
      }
      return {
        date: d.slice(5), // MM-DD
        minutes: seconds / 60,
        seconds,
      };
    });

    const perSubject: Record<string, number> = {};
    days.forEach((d) => {
      const day = loadDay(userId, d);
      let bySubject: Record<string, number> = day?.dailySecondsBySubject ?? {};
      if (d === todayKey) {
        bySubject = mergeSecondsBySubject(bySubject, state.dailySecondsBySubject);
      }
      for (const [sid, secs] of Object.entries(bySubject)) {
        perSubject[sid] =
          (perSubject[sid] ?? 0) + (typeof secs === "number" ? secs : 0);
      }
    });

    const weeklyTargetMinutes = state.goalMinutes * 7;
    const weeklySeconds = perDay.reduce((sum, x) => sum + x.seconds, 0);

    const perSubjectRows = Object.entries(perSubject)
      .map(([subjectId, seconds]) => ({
        subjectId,
        subjectName:
          subjectId === "unassigned"
            ? "Other"
            : (baseSubjects.find((s) => s.id === subjectId)?.name ?? subjectId),
        seconds: Math.max(0, Math.floor(seconds ?? 0)),
      }))
      .filter((r) => r.seconds > 0)
      .sort((a, b) => b.seconds - a.seconds);

    return {
      days,
      perDay,
      perSubjectRows,
      weeklySeconds,
      weeklyTargetMinutes,
    };
  }, [
    userId,
    state.goalMinutes,
    state.dailySeconds,
    state.dailySecondsBySubject,
    todayKey,
    studyMergeRev,
  ]);

  const streak = useMemo(() => {
    if (!userId) return 0;

    const today = new Date();
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateString(d);
      const day = loadDay(userId, key);
      let seconds = typeof day?.dailySeconds === "number" ? day.dailySeconds : 0;
      if (key === todayKey) {
        seconds = Math.max(seconds, state.dailySeconds);
      }
      if (seconds >= state.goalMinutes * 60) count++;
      else break;
    }
    return count;
  }, [userId, state.goalMinutes, state.dailySeconds, todayKey, studyMergeRev]);

  return (
    <AppShell title="Track My Study" subtitle="Run your timer and track progress.">
      <div className="mx-auto max-w-6xl space-y-6 text-[#0b0f19]">
        <div className="flex justify-end">
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#0b0f19]/70">
            <Clock className="size-4 text-brand" />
            {state.phase === "break" ? "Take a break" : "Study time"}
          </div>
        </div>

        {/* Range toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-[999px] border border-black/10 bg-white p-2">
              <Button
                size="sm"
                variant={rangeMode === "day" ? "default" : "ghost"}
                className={rangeMode === "day" ? "rounded-full bg-brand text-white" : "rounded-full text-[#0b0f19]/70 hover:text-[#0b0f19]"}
                onClick={() => setRangeMode("day")}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={rangeMode === "week" ? "default" : "ghost"}
                className={rangeMode === "week" ? "rounded-full bg-brand text-white" : "rounded-full text-[#0b0f19]/70 hover:text-[#0b0f19]"}
                onClick={() => setRangeMode("week")}
              >
                Week
              </Button>
            </div>

          {/* Settings */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
                <Label htmlFor="goal-minutes" className="text-xs text-[#0b0f19]/60">
                  Goal (min/day)
                </Label>
                <Input
                  id="goal-minutes"
                  type="number"
                  min={1}
                  max={480}
                  value={state.goalMinutes}
                  onChange={(e) => setGoalMinutes(Number(e.target.value))}
                  className="w-28 border-black/10 bg-white text-[#0b0f19]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="session-minutes" className="text-xs text-[#0b0f19]/60">
                  Session (min)
                </Label>
                <Input
                  id="session-minutes"
                  type="number"
                  min={10}
                  max={120}
                  value={state.sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  disabled={state.phase === "session" && state.isRunning}
                  className="w-28 border-black/10 bg-white text-[#0b0f19]"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="break-minutes" className="text-xs text-[#0b0f19]/60">
                  Break (min)
                </Label>
                <Input
                  id="break-minutes"
                  type="number"
                  min={0}
                  max={90}
                  value={state.breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  className="w-28 border-black/10 bg-white text-[#0b0f19]"
                />
              </div>
          </div>
        </div>

          {/* Main grid */}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            {/* Timer */}
            <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 font-display text-xl">
                    {state.phase === "break" ? (
                      <Coffee className="size-5 text-brand" />
                    ) : (
                      <Flame className="size-5 text-brand" />
                    )}
                    {phaseLabel} Timer
                  </CardTitle>

                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full border-black/10 bg-white text-[#0b0f19] hover:bg-black/5"
                    onClick={() => setTimerFullscreen(true)}
                    aria-label="Fullscreen timer"
                  >
                    <Maximize2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Active subject selection */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-[#0b0f19]/70">
                    Studying:{" "}
                    <span className="font-semibold text-[#0b0f19]">
                      {activeSubject?.name ?? "Select a subject"}
                    </span>
                  </div>
                  <div className="w-full sm:w-64">
                    <Select
                      value={activeSubjectIdOrFirst}
                      onValueChange={(val) => {
                        if (!val) return;
                        selectSubject(val);
                      }}
                    >
                      <SelectTrigger className="bg-white border-brand/30 text-brand focus:ring-brand/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {baseSubjects.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Circular timer */}
                <div className="flex items-center justify-center">
                  <div className="relative" style={{ width: ringSize, height: ringSize }}>
                    <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-slate-300"
                      />
                      <circle
                        cx={ringSize / 2}
                        cy={ringSize / 2}
                        r={radius}
                        fill="none"
                        stroke="#94a3b8"
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
                      <span className="font-display text-5xl font-bold tracking-tight">
                        {formatSeconds(state.remainingSeconds)}
                      </span>
                      <span className="mt-2 text-sm text-[#0b0f19]/60">
                        {state.phase === "break"
                          ? "Break remaining"
                          : state.isRunning
                            ? "Session running"
                            : "Session paused"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Manual Start / Stop */}
                <div className="flex items-center justify-center gap-3 pt-1">
                  <Button
                    onClick={() => setRunningSession(!state.isRunning)}
                    className={
                      state.isRunning
                        ? "bg-[#0b0f19] text-white hover:bg-[#0b0f19]/90 border border-transparent"
                        : "bg-brand text-white hover:bg-brand-dark border border-transparent"
                    }
                  >
                    {state.isRunning ? (
                      <>
                        <Pause className="size-4" />
                        Stop timer
                      </>
                    ) : (
                      <>
                        <Play className="size-4" />
                        Start timer
                      </>
                    )}
                  </Button>
                </div>

                {/* Goal progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#0b0f19]/70 flex items-center gap-2">
                      <Target className="size-4 text-brand" />
                      Progress vs goal
                    </span>
                    <span className="font-semibold tabular-nums text-[#0b0f19]">
                      {Math.min(100, goalPct * 100).toFixed(1)}%
                    </span>
                  </div>
                <Progress
                  value={Math.min(100, goalPct * 100)}
                  className="h-3 bg-black/10"
                />
                </div>

                {/* Streak */}
                <Separator className="bg-black/10" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-[#0b0f19]/70">Streak</div>
                  <div className="text-right">
                    <div className="font-display text-3xl font-bold text-[#0b0f19]">
                      {streak}
                    </div>
                    <div className="text-xs text-[#0b0f19]/55">
                      days in a row reaching your goal
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {timerFullscreen && (
              <div
                className="fixed inset-0 z-[200] flex flex-col bg-black/80"
                role="dialog"
                aria-modal="true"
                aria-label="Fullscreen study timer"
              >
                <div className="flex shrink-0 justify-end px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 rounded-full border-white/20 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => setTimerFullscreen(false)}
                    aria-label="Exit fullscreen"
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
                  <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 py-2">
                    <div className="rounded-3xl border border-black/10 bg-white shadow-2xl">
                      <div className="flex flex-wrap items-center gap-4 border-b border-black/10 px-4 py-4 sm:px-8 sm:py-5">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {state.phase === "break" ? (
                            <Coffee className="size-7 shrink-0 text-brand" />
                          ) : (
                            <Flame className="size-7 shrink-0 text-brand" />
                          )}
                          <div className="min-w-0">
                            <div className="font-display text-2xl leading-tight text-[#0b0f19] sm:text-3xl">
                              {phaseLabel} Timer
                            </div>
                            <div className="text-sm text-[#0b0f19]/60">
                              {state.phase === "break"
                                ? "Take a break"
                                : state.isRunning
                                  ? "Session running"
                                  : "Session paused"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-8 px-4 py-6 sm:gap-10 sm:px-8 sm:py-8 lg:grid-cols-[1fr_min(100%,280px)] lg:items-start">
                        <div className="flex w-full justify-center">
                          <div className="relative mx-auto aspect-square w-full max-w-[min(88vw,calc(100dvh-11rem),640px)] shrink-0">
                            <svg
                              className="h-full w-full"
                              viewBox="0 0 640 640"
                              preserveAspectRatio="xMidYMid meet"
                            >
                              <circle
                                cx={320}
                                cy={320}
                                r={292}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={20}
                                className="text-slate-300"
                              />
                              <circle
                                cx={320}
                                cy={320}
                                r={292}
                                fill="none"
                                stroke="#94a3b8"
                                strokeWidth={20}
                                strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 292}
                                strokeDashoffset={
                                  2 * Math.PI * 292 -
                                  (progressPct / 100) * (2 * Math.PI * 292)
                                }
                                className="transition-[stroke-dashoffset] duration-500 ease-out"
                                style={{
                                  transform: "rotate(-90deg)",
                                  transformOrigin: "50% 50%",
                                }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                              <div className="font-display text-[clamp(40px,min(12vw,11dvh),120px)] font-bold leading-none tracking-tight text-[#0b0f19]">
                                {formatSeconds(state.remainingSeconds)}
                              </div>
                              <div className="mt-2 text-sm text-[#0b0f19]/60 sm:mt-4 sm:text-base">
                                Remaining
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col justify-center gap-4 pb-2 lg:pb-0">
                          <Button
                            onClick={() => setRunningSession(!state.isRunning)}
                            className={
                              state.isRunning
                                ? "h-14 bg-[#0b0f19] text-lg text-white hover:bg-[#0b0f19]/90"
                                : "h-14 bg-brand text-lg text-white hover:bg-brand-dark"
                            }
                          >
                            {state.isRunning ? (
                              <>
                                <Pause className="size-6" />
                                Stop timer
                              </>
                            ) : (
                              <>
                                <Play className="size-6" />
                                Start timer
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Overview */}
            <div className="space-y-6">
            <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-3 font-display text-xl">
                    <span>
                      {rangeMode === "day" ? "Today by Subject" : "This Week by Subject"}
                    </span>
                    <span className="text-sm font-medium tabular-nums text-[#0b0f19]/70">
                      {rangeMode === "day"
                        ? formatSeconds(state.dailySeconds)
                        : formatSeconds(weekData?.weeklySeconds ?? 0)}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table className="text-[#0b0f19]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[#0b0f19]/60">Subject</TableHead>
                        <TableHead className="text-right text-[#0b0f19]/60">Questions</TableHead>
                        <TableHead className="text-right text-[#0b0f19]/60">Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rangeMode === "day" ? (
                        daySubjectRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-[#0b0f19]/60">
                              No study yet today.
                            </TableCell>
                          </TableRow>
                        ) : (
                          daySubjectRows.slice(0, 8).map((row) => (
                            <TableRow key={row.subjectId}>
                              <TableCell className="text-[#0b0f19]">{row.subjectName}</TableCell>
                              <TableCell className="text-right font-medium text-[#0b0f19] tabular-nums">
                                {row.questionsAnswered}
                              </TableCell>
                              <TableCell className="text-right font-medium text-[#0b0f19] tabular-nums">
                                {formatSeconds(row.seconds)}
                              </TableCell>
                            </TableRow>
                          ))
                        )
                      ) : weekData?.perSubjectRows?.length ? (
                        weekData.perSubjectRows.slice(0, 8).map((row) => (
                          <TableRow key={row.subjectId}>
                            <TableCell className="text-[#0b0f19]">
                              {row.subjectName}
                            </TableCell>
                            <TableCell className="text-right text-[#0b0f19]/40">—</TableCell>
                            <TableCell className="text-right font-medium text-[#0b0f19] tabular-nums">
                              {formatSeconds(row.seconds)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                        <TableCell colSpan={3} className="text-center text-[#0b0f19]/60">
                            No study logged this week yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-xl">
                    {rangeMode === "day" ? "Breakdown (Graph)" : "Week Overview (Graph)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rangeMode === "day" ? (
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={daySubjectRows.map((r) => ({
                            name: r.subjectName,
                            minutes: r.seconds / 60,
                            seconds: r.seconds,
                          }))}
                        >
                          <CartesianGrid stroke="rgba(0,0,0,0.10)" strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fill: "rgba(15,23,42,0.75)", fontSize: 12 }} interval={0} />
                          <YAxis tick={{ fill: "rgba(15,23,42,0.75)" }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(255,255,255,0.98)", border: "1px solid rgba(15,23,42,0.12)", color: "#0b0f19" }}
                            formatter={(value, _name, item) => {
                              const sec = (item?.payload as { seconds?: number })?.seconds;
                              const s =
                                typeof sec === "number"
                                  ? sec
                                  : Math.round(Number(value) * 60);
                              return [formatSeconds(s), "Time"];
                            }}
                          />
                          <Bar dataKey="minutes" fill="#56abe6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : weekData ? (
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <LineChart
                          data={weekData.perDay.map((d) => ({
                            date: d.date,
                            minutes: d.seconds / 60,
                            goal: state.goalMinutes,
                            seconds: d.seconds,
                          }))}
                          margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                        >
                          <CartesianGrid stroke="rgba(0,0,0,0.10)" strokeDasharray="3 3" />
                          <XAxis dataKey="date" tick={{ fill: "rgba(15,23,42,0.75)", fontSize: 12 }} />
                          <YAxis tick={{ fill: "rgba(15,23,42,0.75)" }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(255,255,255,0.98)", border: "1px solid rgba(15,23,42,0.12)", color: "#0b0f19" }}
                            formatter={(v, name, item) => {
                              if (String(name) === "goal") {
                                return [`${v} min`, "Goal"];
                              }
                              const sec = (item?.payload as { seconds?: number })?.seconds;
                              const s =
                                typeof sec === "number"
                                  ? sec
                                  : Math.round(Number(v) * 60);
                              return [formatSeconds(s), "Time"];
                            }}
                          />
                          <Line type="monotone" dataKey="minutes" stroke="#56abe6" strokeWidth={3} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="goal" stroke="rgba(15,23,42,0.45)" strokeDasharray="6 6" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </AppShell>
  );
}

