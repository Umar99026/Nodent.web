import { STORAGE_KEYS } from "@/lib/constants";
import { mergeSecondsBySubject } from "@/lib/utils";

export function studyDayStorageKey(userId: string, date: string): string {
  return `${STORAGE_KEYS.studyPrefix}${userId}_${date}`;
}

export function listUserStudyDates(userId: string): string[] {
  const prefix = `${STORAGE_KEYS.studyPrefix}${userId}_`;
  const dates: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(prefix)) continue;
    const date = key.slice(prefix.length);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.push(date);
  }
  return dates.sort();
}

/** Merge server totals into a non-active study day in localStorage. */
export function mergeRemoteIntoStudyStorage(
  userId: string,
  date: string,
  remoteSeconds: number,
  remoteBySubject: Record<string, number>,
): void {
  const key = studyDayStorageKey(userId, date);
  let local: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(key);
    if (raw) local = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    local = {};
  }
  const localSub = (local.dailySecondsBySubject as Record<string, number>) ?? {};
  const mergedSub = mergeSecondsBySubject(localSub, remoteBySubject);
  const sumSub = Object.values(mergedSub).reduce(
    (a, n) => a + Math.max(0, Math.floor(Number(n) || 0)),
    0,
  );
  const dailySeconds = Math.max(
    Math.floor(Number(local.dailySeconds) || 0),
    Math.floor(remoteSeconds || 0),
    sumSub,
  );
  const next = {
    ...local,
    dailySeconds,
    dailySecondsBySubject: mergedSub,
  };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore quota
  }
}

export type TodayStudyOverride = {
  dailySeconds: number;
  dailySecondsBySubject: Record<string, number>;
};

/**
 * Build payloads for POST /api/study/sync. Uses live `todayOverride` for the
 * current calendar day so in-memory timer state is not behind localStorage.
 */
export function collectStudyDaysForSync(
  userId: string,
  todayIso: string,
  goalMinutes: number,
  todayOverride?: TodayStudyOverride,
): Array<{
  date: string;
  dailySeconds: number;
  dailySecondsBySubject: Record<string, number>;
  goalMinutes?: number;
}> {
  const dates = listUserStudyDates(userId);
  const dateSet = new Set(dates);
  if (!dateSet.has(todayIso)) {
    dates.push(todayIso);
    dates.sort();
  }

  return dates.map((date) => {
    let raw: Record<string, unknown> = {};
    try {
      const s = localStorage.getItem(studyDayStorageKey(userId, date));
      if (s) raw = JSON.parse(s) as Record<string, unknown>;
    } catch {
      raw = {};
    }
    let dailySeconds = Math.max(0, Math.floor(Number(raw.dailySeconds) || 0));
    let dailySecondsBySubject =
      (raw.dailySecondsBySubject as Record<string, number>) ?? {};

    if (date === todayIso && todayOverride) {
      dailySecondsBySubject = mergeSecondsBySubject(
        dailySecondsBySubject,
        todayOverride.dailySecondsBySubject,
      );
      const sumSub = Object.values(dailySecondsBySubject).reduce(
        (a, n) => a + Math.max(0, Math.floor(Number(n) || 0)),
        0,
      );
      dailySeconds = Math.max(
        dailySeconds,
        todayOverride.dailySeconds,
        sumSub,
      );
    }

    const entry: {
      date: string;
      dailySeconds: number;
      dailySecondsBySubject: Record<string, number>;
      goalMinutes?: number;
    } = { date, dailySeconds, dailySecondsBySubject };
    if (date === todayIso) entry.goalMinutes = goalMinutes;
    return entry;
  });
}
