import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { STORAGE_KEYS } from "@/lib/constants";
import {
  collectStudyDaysForSync,
  mergeRemoteIntoStudyStorage,
} from "@/lib/studyLocal";
import { addDaysToLocalISO, localDateISO, mergeSecondsBySubject } from "@/lib/utils";

type StudyPhase = "session" | "break";

export interface StudyTimerState {
  // Overall time studied for the day (seconds)
  dailySeconds: number;
  // Per-subject time studied for the day (seconds)
  dailySecondsBySubject: Record<string, number>;
  goalMinutes: number;
  sessionMinutes: number;
  breakMinutes: number;
  sessionsCompleted: number;
  phase: StudyPhase;
  activeSubjectId: string | null;
  // Remaining seconds for the current phase
  remainingSeconds: number;
  // Whether the current phase timer is actively counting down
  isRunning: boolean;
  // If true, the user manually paused the timer and auto-start should not resume it.
  manualPaused: boolean;
}

interface StudyTimerContextValue {
  state: StudyTimerState;
  selectSubject: (subjectId: string) => void;
  setGoalMinutes: (minutes: number) => void;
  setSessionMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  // For debugging / future UI: allow forcing pause when phase=session.
  setRunningSession: (running: boolean) => void;
}

const StudyTimerContext = createContext<StudyTimerContextValue | null>(null);

function storageKey(userId: string): string {
  return STORAGE_KEYS.studyPrefix + userId + "_" + localDateISO();
}

const DEFAULTS: StudyTimerState = {
  dailySeconds: 0,
  dailySecondsBySubject: {},
  goalMinutes: 120,
  sessionMinutes: 25,
  breakMinutes: 5,
  sessionsCompleted: 0,
  phase: "session",
  activeSubjectId: null,
  remainingSeconds: 25 * 60,
  isRunning: false,
  manualPaused: false,
};

function loadState(raw: string | null): StudyTimerState {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<StudyTimerState> & {
      dailySecondsBySubject?: Record<string, number>;
    };

    const sessionMinutes = Math.max(
      1,
      Math.min(120, Number(parsed.sessionMinutes ?? DEFAULTS.sessionMinutes)),
    );
    const breakMinutes = Math.max(
      0,
      Math.min(90, Number(parsed.breakMinutes ?? DEFAULTS.breakMinutes)),
    );

    const phase: StudyPhase =
      parsed.phase === "break" ? "break" : "session";

    return {
      ...DEFAULTS,
      ...parsed,
      sessionMinutes,
      breakMinutes,
      phase,
      dailySecondsBySubject: parsed.dailySecondsBySubject ?? {},
      manualPaused:
        typeof parsed.manualPaused === "boolean"
          ? parsed.manualPaused
          : DEFAULTS.manualPaused,
      // If state was saved in the past and remainingSeconds is missing, reset.
      remainingSeconds:
        typeof parsed.remainingSeconds === "number"
          ? parsed.remainingSeconds
          : (phase === "break" ? breakMinutes : sessionMinutes) * 60,
      // Always keep the timer paused on refresh until we know the route.
      isRunning: false,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function StudyTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const userId = user ? String(user.id) : null;

  const [state, setState] = useState<StudyTimerState>(() => {
    if (!userId) return { ...DEFAULTS };
    try {
      return loadState(localStorage.getItem(storageKey(userId)));
    } catch {
      return { ...DEFAULTS };
    }
  });

  // Keep refs to avoid stale closures inside setInterval.
  const isOnPracticeRef = useRef(false);
  const isOnTrackRef = useRef(false);
  const activeSubjectIdRef = useRef<string | null>(null);
  const prevPathRef = useRef<string>("");
  const lastWallClockTickRef = useRef<number | null>(null);

  const quizMatch = useMemo(() => {
    // Main practice and wrong-answer review (not /summary).
    const wrong = location.pathname.match(/^\/quiz\/([^/]+)\/wrong\/?$/);
    if (wrong) return { subjectId: wrong[1] };
    const main = location.pathname.match(/^\/quiz\/([^/]+)\/?$/);
    if (main) return { subjectId: main[1] };
    return null;
  }, [location.pathname]);

  const isOnPractice = !!quizMatch;
  const isOnTrack = location.pathname.startsWith("/track");

  useEffect(() => {
    isOnPracticeRef.current = isOnPractice;
  }, [isOnPractice]);

  useEffect(() => {
    isOnTrackRef.current = isOnTrack;
  }, [isOnTrack]);

  useEffect(() => {
    activeSubjectIdRef.current = state.activeSubjectId;
  }, [state.activeSubjectId]);

  const advanceStudySecond = useCallback((prev: StudyTimerState): StudyTimerState => {
    if (prev.remainingSeconds <= 1) {
      if (prev.phase === "session") {
        return {
          ...prev,
          sessionsCompleted: prev.sessionsCompleted + 1,
          phase: "break",
          remainingSeconds: prev.breakMinutes * 60,
          isRunning: !prev.manualPaused,
        };
      }

      return {
        ...prev,
        phase: "session",
        remainingSeconds: prev.sessionMinutes * 60,
        isRunning:
          (isOnPracticeRef.current || isOnTrackRef.current) &&
          !prev.manualPaused,
      };
    }

    if (prev.phase === "session") {
      const subjectId = prev.activeSubjectId ?? "unassigned";
      return {
        ...prev,
        remainingSeconds: prev.remainingSeconds - 1,
        dailySeconds: prev.dailySeconds + 1,
        dailySecondsBySubject: {
          ...prev.dailySecondsBySubject,
          [subjectId]: (prev.dailySecondsBySubject[subjectId] ?? 0) + 1,
        },
      };
    }

    return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
  }, []);

  // Load state when user changes.
  useEffect(() => {
    if (!userId) return;
    try {
      setState(loadState(localStorage.getItem(storageKey(userId))));
    } catch {
      setState({ ...DEFAULTS });
    }
  }, [userId]);

  const stateRef = useRef(state);
  stateRef.current = state;

  // Pull study history from server (merge into localStorage + today in React state).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const to = localDateISO();
        const from = addDaysToLocalISO(to, -400);
        const data = await apiFetch<{
          days: {
            date: string;
            dailySeconds: number;
            dailySecondsBySubject: Record<string, number>;
          }[];
        }>(
          `/api/study/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
        if (cancelled) return;
        const today = localDateISO();
        let mergedPast = false;
        for (const day of data.days ?? []) {
          if (day.date === today) {
            setState((prev) => {
              if (localDateISO() !== today) return prev;
              const rSub = day.dailySecondsBySubject ?? {};
              const mergedSub = mergeSecondsBySubject(
                prev.dailySecondsBySubject,
                rSub,
              );
              const sumSub = Object.values(mergedSub).reduce(
                (acc, n) => acc + Math.max(0, Math.floor(Number(n) || 0)),
                0,
              );
              const dailySeconds = Math.max(
                prev.dailySeconds,
                Math.floor(Number(day.dailySeconds) || 0),
                sumSub,
              );
              return { ...prev, dailySeconds, dailySecondsBySubject: mergedSub };
            });
          } else {
            mergeRemoteIntoStudyStorage(
              userId,
              day.date,
              day.dailySeconds,
              day.dailySecondsBySubject ?? {},
            );
            mergedPast = true;
          }
        }
        if (mergedPast) {
          window.dispatchEvent(new CustomEvent("nodent-study-merged"));
        }
      } catch {
        // offline / unauthenticated
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Push all local study days to server periodically (cross-device history).
  useEffect(() => {
    if (!userId) return;
    const run = () => {
      const st = stateRef.current;
      const today = localDateISO();
      const days = collectStudyDaysForSync(userId, today, st.goalMinutes, {
        dailySeconds: st.dailySeconds,
        dailySecondsBySubject: st.dailySecondsBySubject,
      });
      void apiFetch("/api/study/sync", {
        method: "POST",
        body: JSON.stringify({ days }),
      }).catch(() => {});
    };
    const interval = window.setInterval(run, 90000);
    const onVis = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVis);
    const boot = window.setTimeout(run, 5000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(boot);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId]);

  // Persist state.
  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, userId]);

  // Sync study totals to server (debounced).
  useEffect(() => {
    if (!userId) return;
    const d = localDateISO();
    const handle = window.setTimeout(() => {
      void apiFetch("/api/study/daily", {
        method: "PUT",
        body: JSON.stringify({
          date: d,
          dailySeconds: state.dailySeconds,
          dailySecondsBySubject: state.dailySecondsBySubject,
          goalMinutes: state.goalMinutes,
        }),
      }).catch(() => {});
    }, 800);
    return () => window.clearTimeout(handle);
  }, [userId, state.dailySeconds, state.goalMinutes, state.dailySecondsBySubject]);

  // Other tabs / windows: refresh when localStorage study key changes.
  useEffect(() => {
    if (!userId) return;
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key !== storageKey(userId)) return;
      try {
        setState(loadState(e.newValue));
      } catch {
        // ignore
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  // Route-driven running state:
  // - Entering practice: if session timer isn't running, start it.
  // - Leaving practice: pause it.
  // - Track page can still run (manual controls live there).
  useEffect(() => {
    if (!userId) return;

    const prevPath = prevPathRef.current;
    const wasOnPractice = /^\/quiz\/([^/]+)\/?$/.test(prevPath);
    prevPathRef.current = location.pathname;

    setState((prev) => {
      const nextActiveSubjectId = quizMatch?.subjectId ?? prev.activeSubjectId;

      // If we just left practice, always pause (even if navigating to /track).
      if (wasOnPractice && !isOnPractice) {
        return {
          ...prev,
          activeSubjectId: nextActiveSubjectId,
          isRunning: false,
        };
      }

      // Practice: always ensure the timer is running when you enter.
      if (isOnPractice) {
        return {
          ...prev,
          activeSubjectId: nextActiveSubjectId,
          manualPaused: false,
          isRunning: true,
        };
      }

      // Track: do not auto-start. Keep whatever the user set manually.
      if (isOnTrack) {
        return {
          ...prev,
          activeSubjectId: nextActiveSubjectId,
          isRunning: prev.isRunning && !prev.manualPaused,
        };
      }

      // Any other page: pause the timer.
      return {
        ...prev,
        activeSubjectId: nextActiveSubjectId,
        isRunning: false,
      };
    });
  }, [isOnPractice, isOnTrack, quizMatch?.subjectId, userId, location.pathname]);

  // Timer tick: wall-clock based, fast UI refresh (handles throttled background tabs).
  useEffect(() => {
    if (!state.isRunning) {
      lastWallClockTickRef.current = null;
      return;
    }
    if (lastWallClockTickRef.current === null) {
      lastWallClockTickRef.current = Date.now();
    }

    const id = window.setInterval(() => {
      setState((prev) => {
        if (!prev.isRunning) return prev;
        const now = Date.now();
        const anchor = lastWallClockTickRef.current ?? now;
        let delta = Math.floor((now - anchor) / 1000);
        if (delta < 0) delta = 0;
        if (delta > 12) delta = 12;
        lastWallClockTickRef.current = anchor + delta * 1000;

        let s = prev;
        for (let i = 0; i < delta; i++) {
          s = advanceStudySecond(s);
        }
        return s;
      });
    }, 200);

    return () => window.clearInterval(id);
  }, [state.isRunning, advanceStudySecond]);

  const selectSubject = useCallback((subjectId: string) => {
    setState((prev) => ({ ...prev, activeSubjectId: subjectId }));
  }, []);

  const setGoalMinutes = useCallback((minutes: number) => {
    setState((prev) => ({
      ...prev,
      goalMinutes: Math.max(1, Math.min(480, Math.round(minutes))),
    }));
  }, []);

  const setSessionMinutes = useCallback((minutes: number) => {
    const mins = Math.max(10, Math.min(120, Math.round(minutes)));
    setState((prev) => ({
      ...prev,
      sessionMinutes: mins,
      // Only reset countdown if not running or phase is session.
      remainingSeconds:
        prev.phase === "session" ? mins * 60 : prev.remainingSeconds,
    }));
  }, []);

  const setBreakMinutes = useCallback((minutes: number) => {
    const mins = Math.max(0, Math.min(90, Math.round(minutes)));
    setState((prev) => ({
      ...prev,
      breakMinutes: mins,
      remainingSeconds:
        prev.phase === "break" ? mins * 60 : prev.remainingSeconds,
    }));
  }, []);

  const setRunningSession = useCallback((running: boolean) => {
    const onPractice = isOnPracticeRef.current;
    const onTrack = isOnTrackRef.current;
    setState((prev) => {
      const manualPaused = !running;

      if (prev.phase === "break") {
        return { ...prev, manualPaused, isRunning: running };
      }

      // session
      return {
        ...prev,
        manualPaused,
        isRunning: running && (onPractice || onTrack),
      };
    });
  }, []);

  const value = useMemo<StudyTimerContextValue>(
    () => ({
      state,
      selectSubject,
      setGoalMinutes,
      setSessionMinutes,
      setBreakMinutes,
      setRunningSession,
    }),
    [
      state,
      selectSubject,
      setGoalMinutes,
      setSessionMinutes,
      setBreakMinutes,
      setRunningSession,
    ],
  );

  return (
    <StudyTimerContext.Provider value={value}>
      {children}
    </StudyTimerContext.Provider>
  );
}

export function useStudyTimer() {
  const ctx = useContext(StudyTimerContext);
  if (!ctx) throw new Error("useStudyTimer must be used in StudyTimerProvider");
  return ctx;
}
