export const LANDING_DEMO_STEPS = [
  { id: "subject", label: "Pick a subject", durationMs: 2800 },
  { id: "answer", label: "Answer questions", durationMs: 3200 },
  { id: "score", label: "See your score", durationMs: 2600 },
  { id: "rank", label: "Climb the leaderboard", durationMs: 3200 },
  { id: "track", label: "Track your growth", durationMs: 2800 },
] as const;

export type LandingDemoStepId = (typeof LANDING_DEMO_STEPS)[number]["id"];
