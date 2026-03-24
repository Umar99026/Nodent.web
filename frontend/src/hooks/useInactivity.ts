import { useEffect, useRef, useState, useCallback } from "react";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

/**
 * Detects user inactivity after a configurable timeout (default 10 minutes).
 * Listens to mouse, keyboard, touch, and scroll events.
 *
 * @returns `{ isInactive, resetInactivity }`
 */
export function useInactivity(timeoutMs = INACTIVITY_TIMEOUT_MS) {
  const [isInactive, setIsInactive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsInactive(false);
    timerRef.current = setTimeout(() => {
      setIsInactive(true);
    }, timeoutMs);
  }, [timeoutMs]);

  const resetInactivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [resetTimer]);

  return { isInactive, resetInactivity };
}
