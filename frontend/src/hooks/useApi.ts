import { useState, useCallback, useRef } from "react";
import { apiFetch, type ApiError } from "@/lib/api";

interface UseApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface UseApiReturn<T> extends UseApiState<T> {
  execute: (path: string, options?: RequestInit) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for API calls with loading / error state management.
 * Returns `execute(path, options)` which triggers a fetch and updates state.
 */
export function useApi<T = unknown>(): UseApiReturn<T> {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const activeRequest = useRef(0);

  const execute = useCallback(
    async (path: string, options?: RequestInit): Promise<T | null> => {
      const requestId = ++activeRequest.current;

      setState({ data: null, error: null, isLoading: true });

      try {
        const data = await apiFetch<T>(path, options);
        // Only update state if this is still the latest request
        if (requestId === activeRequest.current) {
          setState({ data, error: null, isLoading: false });
        }
        return data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred";
        const status = (err as ApiError).status;

        // Don't update state for 401 — the apiFetch handler redirects
        if (status === 401) return null;

        if (requestId === activeRequest.current) {
          setState({ data: null, error: message, isLoading: false });
        }
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    activeRequest.current++;
    setState({ data: null, error: null, isLoading: false });
  }, []);

  return { ...state, execute, reset };
}
