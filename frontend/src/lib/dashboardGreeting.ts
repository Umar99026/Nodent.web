const GREETING_STORAGE_PREFIX = "nodent:dashboard-greeting:";

export const DASHBOARD_GREETINGS = [
  "Hey!",
  "What's up",
  "Welcome back",
  "Good to see you",
  "Hi there",
  "Nice to see you",
  "Howdy",
] as const;

/** Punctuation after greeting (spacing comes from layout gap). */
export function greetingNameSeparator(greeting: string): string {
  return greeting.trimEnd().endsWith("!") ? "" : ",";
}

export function getDashboardGreeting(userId: string | number): string {
  const key = `${GREETING_STORAGE_PREFIX}${userId}`;
  try {
    const saved = sessionStorage.getItem(key);
    if (saved && (DASHBOARD_GREETINGS as readonly string[]).includes(saved)) {
      return saved;
    }
    const picked = DASHBOARD_GREETINGS[Math.floor(Math.random() * DASHBOARD_GREETINGS.length)];
    sessionStorage.setItem(key, picked);
    return picked;
  } catch {
    return DASHBOARD_GREETINGS[0];
  }
}

export function clearDashboardGreeting(userId: string | number): void {
  try {
    sessionStorage.removeItem(`${GREETING_STORAGE_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}
