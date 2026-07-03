import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import type { TopicPerformanceSnapshot } from "@/lib/topicPerformanceColor";

type TopicStatRow = {
  topic: string;
  myCorrect?: number | null;
  myTotal?: number;
};

export function useTopicPerformance(subjectId: string | undefined) {
  const { user } = useAuth();
  const [byTopic, setByTopic] = useState<Map<string, TopicPerformanceSnapshot>>(new Map());
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !subjectId) {
      setByTopic(new Map());
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ topicStats?: TopicStatRow[] }>(
        `/api/competition/${subjectId}/stats?range=all`,
      );
      const next = new Map<string, TopicPerformanceSnapshot>();
      for (const row of data.topicStats ?? []) {
        if (!row.topic) continue;
        next.set(row.topic, {
          myCorrect: row.myCorrect ?? null,
          myTotal: Number(row.myTotal ?? 0),
        });
      }
      setByTopic(next);
    } catch {
      setByTopic(new Map());
    } finally {
      setLoading(false);
    }
  }, [user, subjectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => void refresh();
    window.addEventListener("nodent:scorecard-updated", onUpdate);
    return () => window.removeEventListener("nodent:scorecard-updated", onUpdate);
  }, [refresh]);

  const getStat = useCallback(
    (topic: string) => {
      const direct = byTopic.get(topic);
      if (direct) return direct;
      const lower = topic.trim().toLowerCase();
      for (const [key, val] of byTopic.entries()) {
        if (key.trim().toLowerCase() === lower) return val;
      }
      return undefined;
    },
    [byTopic],
  );

  return { byTopic, getStat, loading, refresh };
}
