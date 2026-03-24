import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatSeconds } from "@/lib/utils";
import { Play, Pause, RotateCcw } from "lucide-react";

interface StudyTimerProps {
  /** Initial duration in minutes */
  duration: number;
  /** Fires when a session countdown reaches zero */
  onSessionComplete: () => void;
  /** Optional callback every tick with remaining seconds */
  onTick?: (remaining: number) => void;
}

export function StudyTimer({
  duration,
  onSessionComplete,
  onTick,
}: StudyTimerProps) {
  const [sessionMinutes, setSessionMinutes] = useState(duration);
  const [remaining, setRemaining] = useState(duration * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onSessionComplete);
  const onTickRef = useRef(onTick);

  // Keep refs fresh
  onCompleteRef.current = onSessionComplete;
  onTickRef.current = onTick;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Tick logic
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          setIsRunning(false);
          setSessionCount((c) => c + 1);
          onCompleteRef.current();
          return sessionMinutes * 60;
        }
        onTickRef.current?.(next);
        return next;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, sessionMinutes]);

  const totalSeconds = sessionMinutes * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;

  // SVG ring dimensions
  const ringSize = 220;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  const handleStart = useCallback(() => setIsRunning(true), []);
  const handlePause = useCallback(() => setIsRunning(false), []);
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setRemaining(sessionMinutes * 60);
  }, [sessionMinutes]);

  const handleDurationChange = (value: string) => {
    const mins = Math.max(1, Math.min(120, Number(value) || 1));
    setSessionMinutes(mins);
    if (!isRunning) {
      setRemaining(mins * 60);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Circular progress ring with timer */}
      <div className="relative flex items-center justify-center">
        <svg
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          className="block"
        >
          {/* Background track */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-white/10"
          />
          {/* Progress arc */}
          <circle
            cx={ringSize / 2}
            cy={ringSize / 2}
            r={radius}
            fill="none"
            stroke="#3f97d8"
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
        {/* Timer text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl font-bold tracking-tight text-white">
            {formatSeconds(remaining)}
          </span>
          <span className="mt-1 text-sm text-white/60">Session {sessionCount}</span>
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

      {/* Session duration setting */}
      <div className="flex items-center gap-3">
        <Label htmlFor="session-duration" className="text-sm text-white/70">
          Session (min)
        </Label>
        <Input
          id="session-duration"
          type="number"
          min={1}
          max={120}
          value={sessionMinutes}
          onChange={(e) => handleDurationChange(e.target.value)}
          disabled={isRunning}
          className="w-20 border-white/20 bg-white/5 text-center text-white"
        />
      </div>
    </div>
  );
}
