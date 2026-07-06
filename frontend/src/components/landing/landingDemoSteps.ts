export const LANDING_DEMO_STEPS = [
  { id: "subject", label: "Pick a subject", durationMs: 2800 },
  { id: "answer", label: "Answer & submit", durationMs: 3200 },
  { id: "score", label: "Get instant feedback", durationMs: 2600 },
  { id: "rank", label: "Stop guessing what to fix", durationMs: 3200 },
  { id: "track", label: "Fix weak topics", durationMs: 2800 },
] as const;

export type LandingDemoStepId = (typeof LANDING_DEMO_STEPS)[number]["id"];
