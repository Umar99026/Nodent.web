import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readHandwritingMode, writeHandwritingMode } from "@/lib/handwritingMode";

type HandwritingModeContextValue = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
};

const HandwritingModeContext = createContext<HandwritingModeContextValue | null>(null);

export function HandwritingModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(readHandwritingMode);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    writeHandwritingMode(next);
  }, []);

  const toggle = useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev;
      writeHandwritingMode(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ enabled, setEnabled, toggle }),
    [enabled, setEnabled, toggle],
  );

  return (
    <HandwritingModeContext.Provider value={value}>
      {children}
    </HandwritingModeContext.Provider>
  );
}

export function useHandwritingMode(): HandwritingModeContextValue {
  const ctx = useContext(HandwritingModeContext);
  if (!ctx) {
    return {
      enabled: false,
      setEnabled: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/** True only when handwriting mode is on AND the active subject is demo. */
export function useHandwritingModeActive(subjectId?: string): boolean {
  const { enabled } = useHandwritingMode();
  void subjectId;
  return enabled;
}
