import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useStudyTimer } from "@/context/StudyTimerContext";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatSeconds } from "@/lib/utils";
import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";

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
import { ChevronLeft, Clock, Coffee, Flame, Target } from "lucide-react";

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

export default function TrackStudyPageNew() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user ? String(user.id) : null;
  const { state, setBreakMinutes, setGoalMinutes, setSessionMinutes, selectSubject } =
    useStudyTimer();

  const [rangeMode, setRangeMode] = useState<RangeMode>("day");

  const activeSubject: Subject | undefined = useMemo(() => {
    if (!state.activeSubjectId) return undefined;
    return baseSubjects.find((s) => s.id === state.activeSubjectId);
  }, [state.activeSubjectId]);

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/dashboard");
  };

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
          baseSubjects.find((s) => s.id === subjectId)?.name ?? subjectId,
        minutes: Math.round(seconds / 60),
        seconds,
      }))
      .filter((r) => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
    return rows;
  }, [state.dailySecondsBySubject]);

  const activeSubjectIdOrFirst = state.activeSubjectId ?? baseSubjects[0]?.id ?? "";

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
      const seconds = typeof day?.dailySeconds === "number" ? day.dailySeconds : 0;
      return {
        date: d.slice(5), // MM-DD
        minutes: Math.round(seconds / 60),
        seconds,
      };
    });

    const perSubject: Record<string, number> = {};
    days.forEach((d) => {
      const day = loadDay(userId, d);
      const bySubject: Record<string, number> = day?.dailySecondsBySubject ?? {};
      for (const [sid, secs] of Object.entries(bySubject)) {
        perSubject[sid] = (perSubject[sid] ?? 0) + (typeof secs === "number" ? secs : 0);
      }
    });

    const weeklyTargetMinutes = state.goalMinutes * 7;
    const weeklyMinutes = perDay.reduce((sum, x) => sum + x.minutes, 0);

    const perSubjectRows = Object.entries(perSubject)
      .map(([subjectId, seconds]) => ({
        subjectId,
        subjectName:
          baseSubjects.find((s) => s.id === subjectId)?.name ?? subjectId,
        minutes: Math.round((seconds ?? 0) / 60),
      }))
      .filter((r) => r.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    return {
      days,
      perDay,
      perSubjectRows,
      weeklyMinutes,
      weeklyTargetMinutes,
    };
  }, [userId, state.goalMinutes]);

  const streak = useMemo(() => {
    if (!userId) return 0;

    const today = new Date();
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateString(d);
      const day = loadDay(userId, key);
      const seconds = typeof day?.dailySeconds === "number" ? day.dailySeconds : 0;
      if (seconds >= state.goalMinutes * 60) count++;
      else break;
    }
    return count;
  }, [userId, state.goalMinutes]);

  return (
    <div className="fixed inset-0 z-40 bg-navy text-white">
      <div className="h-full overflow-auto p-4 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              className="gap-2 text-white/70 hover:text-white"
              onClick={handleBack}
            >
              <ChevronLeft className="size-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
                <Clock className="size-4 text-brand-light" />
                {state.phase === "break" ? "Take a break" : "Study time"}
              </div>
            </div>
          </div>

          {/* Range toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
              <Button
                size="sm"
                variant={rangeMode === "day" ? "default" : "ghost"}
                className={rangeMode === "day" ? "bg-brand text-white" : "text-white/70"}
                onClick={() => setRangeMode("day")}
              >
                Today
              </Button>
              <Button
                size="sm"
                variant={rangeMode === "week" ? "default" : "ghost"}
                className={rangeMode === "week" ? "bg-brand text-white" : "text-white/70"}
                onClick={() => setRangeMode("week")}
              >
                Week
              </Button>
            </div>

            {/* Settings */}
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1">
                <Label htmlFor="goal-minutes" className="text-xs text-white/60">
                  Goal (min/day)
                </Label>
                <Input
                  id="goal-minutes"
                  type="number"
                  min={1}
                  max={480}
                  value={state.goalMinutes}
                  onChange={(e) => setGoalMinutes(Number(e.target.value))}
                  className="w-28 border-white/15 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="session-minutes" className="text-xs text-white/60">
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
                  className="w-28 border-white/15 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="break-minutes" className="text-xs text-white/60">
                  Break (min)
                </Label>
                <Input
                  id="break-minutes"
                  type="number"
                  min={0}
                  max={90}
                  value={state.breakMinutes}
                  onChange={(e) => setBreakMinutes(Number(e.target.value))}
                  className="w-28 border-white/15 bg-white/5 text-white"
                />
              </div>
            </div>
          </div>

          {/* Main grid */}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            {/* Timer */}
            <Card className="border-white/10 bg-white/5 text-white shadow-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display text-xl">
                  {state.phase === "break" ? (
                    <Coffee className="size-5 text-brand-light" />
                  ) : (
                    <Flame className="size-5 text-brand-light" />
                  )}
                  {phaseLabel} Timer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Active subject selection */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-white/70">
                    Studying:{" "}
                    <span className="font-semibold text-white">
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
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
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
                      <span className="font-display text-5xl font-bold tracking-tight">
                        {formatSeconds(state.remainingSeconds)}
                      </span>
                      <span className="mt-2 text-sm text-white/60">
                        {state.phase === "break"
                          ? "Break remaining"
                          : state.isRunning
                            ? "Session running"
                            : "Session paused"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Goal progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/70 flex items-center gap-2">
                      <Target className="size-4 text-brand-light" />
                      Progress vs goal
                    </span>
                    <span className="font-semibold text-white/90">
                      {Math.round(Math.min(100, goalPct * 100))}%
                    </span>
                  </div>
                  <Progress value={Math.round(Math.min(100, goalPct * 100))} className="h-3 bg-white/10" />
                </div>

                {/* Streak */}
                <Separator className="bg-white/10" />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-white/70">
                    Streak
                  </div>
                  <div className="text-right">
                    <div className="font-display text-3xl font-bold text-white">
                      {streak}
                    </div>
                    <div className="text-xs text-white/60">days in a row reaching your goal</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overview */}
            <div className="space-y-6">
              <Card className="border-white/10 bg-white/5 text-white shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-3 font-display text-xl">
                    <span>
                      {rangeMode === "day" ? "Today by Subject" : "This Week by Subject"}
                    </span>
                    <span className="text-sm text-white/60">
                      {rangeMode === "day" ? formatSeconds(state.dailySeconds) : `${weekData?.weeklyMinutes ?? 0} min`}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead className="text-right">Minutes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rangeMode === "day" ? (
                        daySubjectRows.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={2} className="text-center text-white/60">
                              No study yet today.
                            </TableCell>
                          </TableRow>
                        ) : (
                          daySubjectRows.slice(0, 8).map((row) => (
                            <TableRow key={row.subjectId}>
                              <TableCell className="text-white/90">{row.subjectName}</TableCell>
                              <TableCell className="text-right font-medium text-white/90 tabular-nums">
                                {row.minutes}
                              </TableCell>
                            </TableRow>
                          ))
                        )
                      ) : weekData?.perSubjectRows?.length ? (
                        weekData.perSubjectRows.slice(0, 8).map((row) => (
                          <TableRow key={row.subjectId}>
                            <TableCell className="text-white/90">{row.subjectName}</TableCell>
                            <TableCell className="text-right font-medium text-white/90 tabular-nums">
                              {row.minutes}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-white/60">
                            No study logged this week yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-white/5 text-white shadow-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-xl">
                    {rangeMode === "day" ? "Breakdown (Graph)" : "Week Overview (Graph)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rangeMode === "day" ? (
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <BarChart data={daySubjectRows.map((r) => ({ name: r.subjectName, minutes: r.minutes }))}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }} interval={0} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.75)" }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.15)" }}
                            formatter={(v) => [`${v} min`, "Minutes"]}
                          />
                          <Bar dataKey="minutes" fill="#3797D3" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : weekData ? (
                    <div style={{ width: "100%", height: 220 }}>
                      <ResponsiveContainer>
                        <LineChart
                          data={weekData.perDay.map((d) => ({
                            date: d.date,
                            minutes: d.minutes,
                            goal: state.goalMinutes,
                          }))}
                          margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                        >
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                          <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.75)", fontSize: 12 }} />
                          <YAxis tick={{ fill: "rgba(255,255,255,0.75)" }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.15)" }}
                            formatter={(v, name) =>
                              [
                                `${v} min`,
                                String(name) === "goal" ? "Goal" : "Minutes",
                              ] as any
                            }
                          />
                          <Line type="monotone" dataKey="minutes" stroke="#3797D3" strokeWidth={3} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="goal" stroke="rgba(255,255,255,0.6)" strokeDasharray="6 6" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

