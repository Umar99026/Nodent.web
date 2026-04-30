import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useStudyTimer } from "@/context/StudyTimerContext";
import { STORAGE_KEYS } from "@/lib/constants";
import { formatSeconds, localDateISO, mergeSecondsBySubject } from "@/lib/utils";
import { baseSubjects } from "@/lib/subjects";
import type { Subject } from "@/lib/subjects";
import { AppShell } from "@/components/layout/AppShell";
import { NodentWordmark } from "@/components/branding/NodentWordmark";

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
import {
  Play,
  Pause,
  Maximize2,
  X,
} from "lucide-react";

const PROGRESS_VIEW_STORAGE = "nodent_study_progress_view";

function dateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function studyStorageKey(userId: string, date: string): string {
  return STORAGE_KEYS.studyPrefix + userId + "_" + date;
}

function shortXAxisLabel(label: string): string {
  const cleaned = String(label ?? "").trim();
  if (cleaned.length <= 11) return cleaned;
  return `${cleaned.slice(0, 10)}…`;
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

  const [timerFullscreen, setTimerFullscreen] = useState(false);
  const [progressView, setProgressView] = useState<"weekly" | "heatmap">("weekly");
  const fsOverlayRef = useRef<HTMLDivElement | null>(null);

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

  const computeRingSize = () => {
    if (typeof window === "undefined") return 320;
    const minSide = Math.min(window.innerWidth, window.innerHeight);
    // Big and responsive, but leave room for controls.
    return Math.max(260, Math.min(520, Math.floor(minSide * 0.62)));
  };
  const [ringSize, setRingSize] = useState<number>(() => computeRingSize());
  useLayoutEffect(() => {
    const onResize = () => setRingSize(computeRingSize());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
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

  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(`${PROGRESS_VIEW_STORAGE}_${userId}`);
      if (saved === "weekly" || saved === "heatmap") {
        setProgressView(saved);
      }
    } catch {
      // ignore
    }
  }, [userId]);

  const handleProgressViewChange = (next: "weekly" | "heatmap") => {
    setProgressView(next);
    if (!userId) return;
    try {
      localStorage.setItem(`${PROGRESS_VIEW_STORAGE}_${userId}`, next);
    } catch {
      // ignore
    }
  };

  const heatmapData = useMemo(() => {
    if (!userId) return [];
    const today = new Date();
    const cells: { date: string; seconds: number; met: boolean }[] = [];
    const daysBack = 140;
    for (let i = daysBack - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = dateString(d);
      const day = loadDay(userId, key);
      let seconds = typeof day?.dailySeconds === "number" ? day.dailySeconds : 0;
      if (key === todayKey) {
        seconds = Math.max(seconds, state.dailySeconds);
      }
      cells.push({
        date: key,
        seconds,
        met: seconds >= state.goalMinutes * 60,
      });
    }
    return cells;
  }, [userId, todayKey, state.dailySeconds, state.goalMinutes, studyMergeRev]);

  return (
    <AppShell
      title="Track My Study"
      subtitle="Run your timer and track progress."
      edgeToEdgeHeader
    >
      <div className="max-w-none space-y-6 text-[#0b0f19]">
        {/* Top analytics row */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-xl">Today Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
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
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "rgba(15,23,42,0.75)", fontSize: 12 }}
                      interval={0}
                      tickFormatter={shortXAxisLabel}
                      angle={-24}
                      textAnchor="end"
                      height={58}
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fill: "rgba(15,23,42,0.75)" }}
                      domain={[0, Math.max(1, state.goalMinutes)]}
                      allowDataOverflow
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(255,255,255,0.98)",
                        border: "1px solid rgba(15,23,42,0.12)",
                        color: "#0b0f19",
                      }}
                      formatter={(value, _name, item) => {
                        const sec = (item?.payload as { seconds?: number })?.seconds;
                        const s = typeof sec === "number" ? sec : Math.round(Number(value) * 60);
                        return [formatSeconds(s), "Time"];
                      }}
                    />
                    <Bar dataKey="minutes" fill="#56abe6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3 font-display text-xl">
                <span>{progressView === "weekly" ? "Weekly Progress" : "Over-time Heatmap"}</span>
                <div className="inline-flex rounded-lg border border-black/10 bg-slate-50 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={progressView === "weekly" ? "default" : "ghost"}
                    className={
                      progressView === "weekly"
                        ? "h-7 bg-[#0b0f19] px-2.5 text-xs text-white hover:bg-[#0b0f19]/90"
                        : "h-7 px-2.5 text-xs text-[#0b0f19]/70 hover:bg-black/5"
                    }
                    onClick={() => handleProgressViewChange("weekly")}
                  >
                    Weekly
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={progressView === "heatmap" ? "default" : "ghost"}
                    className={
                      progressView === "heatmap"
                        ? "h-7 bg-[#0b0f19] px-2.5 text-xs text-white hover:bg-[#0b0f19]/90"
                        : "h-7 px-2.5 text-xs text-[#0b0f19]/70 hover:bg-black/5"
                    }
                    onClick={() => handleProgressViewChange("heatmap")}
                  >
                    Heatmap
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-black/10 bg-slate-50 px-4 py-3">
                <span className="text-sm text-[#0b0f19]/70">This week total</span>
                <span className="font-semibold tabular-nums">{formatSeconds(weekData?.weeklySeconds ?? 0)}</span>
              </div>
              {progressView === "weekly" ? (
                <div style={{ width: "100%", height: 190 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={(weekData?.perDay ?? []).map((d) => ({
                        date: d.date,
                        minutes: d.seconds / 60,
                        goal: state.goalMinutes,
                        seconds: d.seconds,
                      }))}
                      margin={{ top: 10, right: 10, left: -10, bottom: 10 }}
                    >
                      <CartesianGrid stroke="rgba(0,0,0,0.10)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "rgba(15,23,42,0.75)", fontSize: 12 }}
                        interval="preserveStartEnd"
                        minTickGap={18}
                      />
                      <YAxis
                        tick={{ fill: "rgba(15,23,42,0.75)" }}
                        domain={[0, Math.max(1, state.goalMinutes)]}
                        allowDataOverflow
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(255,255,255,0.98)",
                          border: "1px solid rgba(15,23,42,0.12)",
                          color: "#0b0f19",
                        }}
                        formatter={(v, name, item) => {
                          if (String(name) === "goal") return [`${v} min`, "Goal"];
                          const sec = (item?.payload as { seconds?: number })?.seconds;
                          const s = typeof sec === "number" ? sec : Math.round(Number(v) * 60);
                          return [formatSeconds(s), "Time"];
                        }}
                      />
                      <Line type="monotone" dataKey="minutes" stroke="#56abe6" strokeWidth={3} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="goal" stroke="rgba(15,23,42,0.45)" strokeDasharray="6 6" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-20 gap-1.5">
                    {heatmapData.map((cell) => (
                      <div
                        key={cell.date}
                        title={`${cell.date}: ${formatSeconds(cell.seconds)}${cell.met ? " (target met)" : ""}`}
                        className={
                          cell.met
                            ? "h-3.5 w-3.5 rounded-[3px] bg-emerald-500"
                            : cell.seconds > 0
                              ? "h-3.5 w-3.5 rounded-[3px] bg-emerald-200"
                              : "h-3.5 w-3.5 rounded-[3px] bg-slate-200"
                        }
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#0b0f19]/65">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-[3px] bg-emerald-500" />
                      target met
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-[3px] bg-emerald-200" />
                      studied, below target
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-3 w-3 rounded-[3px] bg-slate-200" />
                      no study
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-3 font-display text-xl">
                <span>Today by Subject</span>
                <span className="text-sm font-medium tabular-nums text-[#0b0f19]/70">
                  {formatSeconds(state.dailySeconds)}
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
                  {daySubjectRows.length === 0 ? (
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
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Daily goal row */}
        <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
          <CardContent className="pt-6">
            <div className="grid gap-4 lg:grid-cols-[240px_1fr_auto] lg:items-end">
              <div className="space-y-1">
                <Label htmlFor="goal-minutes" className="text-xs font-semibold uppercase tracking-wide text-[#0b0f19]/60">
                  Daily Goal (minutes)
                </Label>
                <Input
                  id="goal-minutes"
                  type="number"
                  min={1}
                  max={480}
                  value={state.goalMinutes}
                  onChange={(e) => setGoalMinutes(Number(e.target.value))}
                  className="w-full border-black/10 bg-white text-[#0b0f19]"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#0b0f19]/70">Today's goal progress</span>
                  <span className="font-semibold tabular-nums text-[#0b0f19]">
                    {Math.min(100, goalPct * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(100, goalPct * 100)} className="h-3 bg-black/10" />
                <p className="text-xs text-[#0b0f19]/55">
                  {formatSeconds(state.dailySeconds)} studied today
                </p>
              </div>
              <div className="rounded-xl border border-black/10 bg-slate-50 px-4 py-3 text-right">
                <div className="text-xs text-[#0b0f19]/60">Current streak</div>
                <div className="font-display text-2xl font-bold tabular-nums">{streak}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Timer + controls */}
        <Card className="border-black/10 bg-white text-[#0b0f19] shadow-xl">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <CardTitle className="flex items-center gap-3 text-xl">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand">
                  <img src="/logo.png" alt="Nodent logo" className="h-7 w-7 object-contain" draggable={false} />
                </div>
                <div className="flex min-w-0 flex-col">
                  <NodentWordmark size="sm" variant="onCream" className="-ml-0.5 pb-1.5" />
                  <span className="text-xs font-medium text-[#0b0f19]/55">{phaseLabel} timer</span>
                </div>
              </CardTitle>
              <div className="flex flex-wrap items-end gap-4">
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
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timer control strip */}
            <div className="rounded-2xl border border-black/10 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-[1fr_170px_170px] md:items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-[#0b0f19]/60">Subject</Label>
                  <div className="text-sm text-[#0b0f19]/70">
                    Active:{" "}
                    <span className="font-semibold text-[#0b0f19]">
                      {activeSubject?.name ?? "Select a subject"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="session-minutes-inline" className="text-xs text-[#0b0f19]/60">
                    Session (min)
                  </Label>
                  <Input
                    id="session-minutes-inline"
                    type="number"
                    min={10}
                    max={120}
                    value={state.sessionMinutes}
                    onChange={(e) => setSessionMinutes(Number(e.target.value))}
                    disabled={state.phase === "session" && state.isRunning}
                    className="w-full border-black/10 bg-white text-[#0b0f19]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="break-minutes-inline" className="text-xs text-[#0b0f19]/60">
                    Break (min)
                  </Label>
                  <Input
                    id="break-minutes-inline"
                    type="number"
                    min={0}
                    max={90}
                    value={state.breakMinutes}
                    onChange={(e) => setBreakMinutes(Number(e.target.value))}
                    className="w-full border-black/10 bg-white text-[#0b0f19]"
                  />
                </div>
              </div>
              <div className="mt-3">
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

            <Separator className="bg-black/10" />
            <div className="text-sm text-[#0b0f19]/65">
              Timer is configured with your selected subject, session length, and break length.
            </div>
          </CardContent>
        </Card>

        {timerFullscreen && (
          <div
            ref={fsOverlayRef}
            className="fixed inset-0 z-[200] overflow-hidden bg-[#0b0f19] [touch-action:pan-x_pan-y]"
            role="dialog"
            aria-modal="true"
            aria-label="Fullscreen study timer"
          >
            <div className="relative h-full w-full overflow-hidden">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end gap-3 p-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="pointer-events-auto h-11 w-11 shrink-0 rounded-full border-white/25 bg-white/10 text-white shadow-md backdrop-blur-sm hover:bg-white/18 sm:h-12 sm:w-12"
                  onClick={() => setTimerFullscreen(false)}
                  aria-label="Exit fullscreen"
                >
                  <X className="size-[1.35rem] sm:size-5" strokeWidth={2.25} />
                </Button>
              </div>

              <div className="flex h-full w-full items-center justify-center p-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
                <div className="flex h-full w-full flex-col overflow-hidden rounded-none border-0 bg-[#111418] text-white shadow-2xl sm:rounded-3xl sm:border sm:border-white/10">
                  <div className="flex flex-wrap items-center gap-4 border-b border-white/10 px-4 py-4 sm:px-8 sm:py-5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand">
                        <img
                          src="/logo.png"
                          alt="Nodent logo"
                          className="h-8 w-8 object-contain"
                          draggable={false}
                        />
                      </div>
                      <div className="min-w-0">
                        <NodentWordmark size="sm" variant="onDark" className="-ml-0.5 pb-1.5" />
                        <div className="text-[clamp(0.75rem,3vw,0.875rem)] text-white/60">
                          {phaseLabel} •{" "}
                          {state.phase === "break"
                            ? "Take a break"
                            : state.isRunning
                              ? "Session running"
                              : "Session paused"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-4 py-4 sm:gap-6 sm:px-8 sm:py-6">
                    <div className="flex w-full flex-1 items-center justify-center overflow-hidden">
                      <div className="relative mx-auto aspect-square h-full max-h-[min(74vh,calc(100dvh-14rem))] w-full max-w-[min(96vw,calc(100dvh-14rem),980px)] shrink-0">
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
                            className="text-white/15"
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
                        <div className="absolute inset-0 flex flex-col items-center justify-center px-[max(0.25rem,2vw)]">
                          <div className="font-display text-[clamp(2rem,min(14vw,12dvh),7.5rem)] font-bold leading-none tracking-tight text-white">
                            {formatSeconds(state.remainingSeconds)}
                          </div>
                          <div className="mt-[clamp(0.25rem,2dvh,1rem)] text-[clamp(0.7rem,3.2vw,1rem)] text-white/60">
                            Remaining
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => setRunningSession(!state.isRunning)}
                      className={
                        state.isRunning
                          ? "min-h-12 w-full max-w-[560px] shrink-0 flex-wrap justify-center gap-2 bg-white text-[#0b0f19] hover:bg-white/90 sm:min-h-14"
                          : "min-h-12 w-full max-w-[560px] shrink-0 flex-wrap justify-center gap-2 bg-brand text-white hover:bg-brand-dark sm:min-h-14"
                      }
                    >
                      {state.isRunning ? (
                        <>
                          <Pause className="size-[clamp(1.1rem,3.5vw,1.5rem)] shrink-0" />
                          <span className="text-center leading-snug">
                            <span className="sm:hidden">Stop</span>
                            <span className="hidden sm:inline">Stop timer</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <Play className="size-[clamp(1.1rem,3.5vw,1.5rem)] shrink-0" />
                          <span className="text-center leading-snug">
                            <span className="sm:hidden">Start</span>
                            <span className="hidden sm:inline">Start timer</span>
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

