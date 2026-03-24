import { useState, useEffect, useCallback, useRef } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

interface StudyTimerState {
  elapsed: number; // seconds elapsed in current interval
  isRunning: boolean;
  intervals: number; // completed pomodoro intervals
}

const DEFAULT_INTERVAL_DURATION = 25 * 60; // 25 minutes in seconds

function loadState(subjectId: string): StudyTimerState {
  try {
    const raw = localStorage.getItem(
      `${STORAGE_KEYS.studyPrefix}timer_${subjectId}`,
    );
    if (raw) return JSON.parse(raw) as StudyTimerState;
  } catch {
    // ignore
  }
  return { elapsed: 0, isRunning: false, intervals: 0 };
}

function saveState(subjectId: string, state: StudyTimerState) {
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.studyPrefix}timer_${subjectId}`,
      JSON.stringify(state),
    );
  } catch {
    // ignore
  }
}

/**
 * Pomodoro-style study timer hook.
 *
 * - Counts elapsed seconds in the current interval.
 * - Tracks completed intervals.
 * - Persists state to localStorage keyed by subject.
 *
 * @param subjectId  Unique subject identifier for storage isolation.
 * @param intervalDuration  Seconds per interval (default 25 min).
 */
export function useStudyTimer(
  subjectId: string,
  intervalDuration = DEFAULT_INTERVAL_DURATION,
) {
  const [state, setState] = useState<StudyTimerState>(() =>
    loadState(subjectId),
  );
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Persist on every change
  useEffect(() => {
    saveState(subjectId, state);
  }, [subjectId, state]);

  // Tick logic
  useEffect(() => {
    if (!state.isRunning) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = setInterval(() => {
      setState((prev) => {
        const nextElapsed = prev.elapsed + 1;
        if (nextElapsed >= intervalDuration) {
          return {
            elapsed: 0,
            isRunning: false,
            intervals: prev.intervals + 1,
          };
        }
        return { ...prev, elapsed: nextElapsed };
      });
    }, 1000);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [state.isRunning, intervalDuration]);

  const start = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: true }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ elapsed: 0, isRunning: false, intervals: 0 });
  }, []);

  return {
    elapsed: state.elapsed,
    isRunning: state.isRunning,
    intervals: state.intervals,
    intervalDuration,
    start,
    pause,
    reset,
  };
}
