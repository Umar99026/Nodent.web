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
import { STORAGE_KEYS } from "@/lib/constants";

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

  const quizMatch = useMemo(() => {
    // Practice mode is only the main quiz route: /quiz/:subjectId
    // (Exclude /quiz/:subjectId/summary etc.)
    const m = location.pathname.match(/^\/quiz\/([^/]+)\/?$/);
    return m ? { subjectId: m[1] } : null;
  }, [location.pathname]);

  const isOnPractice = !!quizMatch;
  const isOnTrack = location.pathname.startsWith("/track");
  // (Derived state used previously; keep logic explicit below.)

  useEffect(() => {
    isOnPracticeRef.current = isOnPractice;
  }, [isOnPractice]);

  useEffect(() => {
    isOnTrackRef.current = isOnTrack;
  }, [isOnTrack]);

  useEffect(() => {
    activeSubjectIdRef.current = state.activeSubjectId;
  }, [state.activeSubjectId]);

  // Load state when user changes.
  useEffect(() => {
    if (!userId) return;
    try {
      setState(loadState(localStorage.getItem(storageKey(userId))));
    } catch {
      setState({ ...DEFAULTS });
    }
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

  // Timer tick.
  useEffect(() => {
    if (!state.isRunning) return;

    const t = setInterval(() => {
      setState((prev) => {
        if (!prev.isRunning) return prev;

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

          // phase === "break"
          return {
            ...prev,
            phase: "session",
            remainingSeconds: prev.sessionMinutes * 60,
            // Resume only if still on a timer-capable page.
            isRunning: (isOnPracticeRef.current || isOnTrackRef.current) && !prev.manualPaused,
          };
        }

        // Live accumulation while studying (updates "Today by subject" instantly)
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
      });
    }, 1000);

    return () => clearInterval(t);
  }, [state.isRunning]);

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

