import { useState, useEffect } from "react";
import { apiFetch, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";

export interface Subject {
  id: number;
  name: string;
  description?: string;
  questionCount: number;
  customQuestionCount?: number;
}

interface BootstrapData {
  subjects?: Subject[];
  customQuestions?: Record<string, number>;
  [key: string]: unknown;
}

/**
 * Fetches subjects from the bootstrap endpoint and merges
 * custom question counts into each subject entry.
 */
export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await apiFetch<BootstrapData>(API_PATHS.bootstrap, {
          timeoutMs: BOOTSTRAP_FETCH_TIMEOUT_MS,
        });

        if (cancelled) return;

        const baseSubjects: Subject[] = data.subjects ?? [];
        const customCounts: Record<string, number> =
          data.customQuestions ?? {};

        // Also check localStorage for any locally stored custom questions
        let localCustom: Record<string, number> = {};
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.customQuestions);
          if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown[]>;
            localCustom = Object.fromEntries(
              Object.entries(parsed).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
            );
          }
        } catch {
          // ignore
        }

        const merged = baseSubjects.map((subject) => ({
          ...subject,
          customQuestionCount:
            (customCounts[String(subject.id)] ?? 0) +
            (localCustom[String(subject.id)] ?? 0),
        }));

        setSubjects(merged);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load subjects");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { subjects, isLoading, error };
}
