import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import { subjectsForUser, type Subject } from "@/lib/subjects";

function getLocalSubjects(userId: string): Subject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.mySubjectsPrefix + userId);
    if (!raw) return [];
    return JSON.parse(raw) as Subject[];
  } catch {
    return [];
  }
}

function saveLocalSubjects(userId: string, subjects: Subject[]) {
  localStorage.setItem(
    STORAGE_KEYS.mySubjectsPrefix + userId,
    JSON.stringify(subjects),
  );
}

function withAdminDemoSubject(subjects: Subject[], isAdmin: boolean): Subject[] {
  if (!isAdmin) return subjects.filter((s) => s.id !== "demo");
  if (subjects.some((s) => s.id === "demo")) return subjects;
  const demo = subjectsForUser({ isAdmin: true }).find((s) => s.id === "demo");
  return demo ? [...subjects, demo] : subjects;
}

export type MySubjectRow = {
  subjectId: string;
  confidenceRank: number | null;
};

export function useMySubjects(userId: string, isAdmin: boolean) {
  const [mySubjects, setMySubjects] = useState<Subject[]>(() =>
    withAdminDemoSubject(getLocalSubjects(userId), isAdmin),
  );
  const [confidenceRanks, setConfidenceRanks] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const syncToServer = useCallback(
    (subjects: Subject[], ranks: Record<string, number>) => {
      void apiFetch(API_PATHS.subjects.my, {
        method: "PUT",
        body: JSON.stringify({
          subjectIds: subjects.map((s) => s.id),
          confidenceRanks: ranks,
        }),
      }).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{
          subjectIds?: string[];
          subjects?: MySubjectRow[];
        }>(API_PATHS.subjects.my);
        if (cancelled) return;
        const rows = data.subjects ?? (data.subjectIds ?? []).map((id) => ({
          subjectId: id,
          confidenceRank: null,
        }));
        const ranks: Record<string, number> = {};
        for (const row of rows) {
          if (row.confidenceRank != null) ranks[row.subjectId] = row.confidenceRank;
        }
        const ids = new Set(rows.map((r) => r.subjectId));
        if (ids.size > 0) {
          const visible = subjectsForUser({ isAdmin });
          const next = withAdminDemoSubject(
            visible.filter((s) => ids.has(s.id)),
            isAdmin,
          );
          setMySubjects(next);
          setConfidenceRanks(ranks);
          saveLocalSubjects(userId, next);
        }
      } catch {
        // non-critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isAdmin]);

  const addSubject = useCallback(
    (subject: Subject) => {
      setMySubjects((prev) => {
        if (prev.some((s) => s.id === subject.id)) return prev;
        const next = [...prev, subject];
        saveLocalSubjects(userId, next);
        const ranks = { ...confidenceRanks, [subject.id]: prev.length + 1 };
        setConfidenceRanks(ranks);
        syncToServer(next, ranks);
        toast.success(`Added "${subject.name}"`);
        return next;
      });
    },
    [userId, confidenceRanks, syncToServer],
  );

  const removeSubject = useCallback(
    (subjectId: string) => {
      setMySubjects((prev) => {
        const next = prev.filter((s) => s.id !== subjectId);
        saveLocalSubjects(userId, next);
        const ranks = { ...confidenceRanks };
        delete ranks[subjectId];
        setConfidenceRanks(ranks);
        syncToServer(next, ranks);
        return next;
      });
    },
    [userId, confidenceRanks, syncToServer],
  );

  const sortedByConfidence = useMemo(() => {
    return [...mySubjects].sort((a, b) => {
      const ra = confidenceRanks[a.id] ?? 999;
      const rb = confidenceRanks[b.id] ?? 999;
      return ra - rb;
    });
  }, [mySubjects, confidenceRanks]);

  return {
    mySubjects,
    sortedByConfidence,
    confidenceRanks,
    loading,
    addSubject,
    removeSubject,
    setMySubjects,
    setConfidenceRanks,
  };
}
