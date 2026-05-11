/**
 * Google Sheets `topic` column: use ONE of these strings per row, exactly as written
 * (same spelling and spacing). The app matches this to filters and analytics.
 *
 * Replace or extend lists when you paste your official topic breakdowns.
 */
export const GOOGLE_SHEETS_TOPIC_LABELS: Record<string, readonly string[]> = {
  methods: [
    "Unit 1 — Functions, relations and graphs",
    "Unit 1 — Algebra, number and structure",
    "Unit 1 — Calculus",
    "Unit 1 — Data analysis, probability and statistics",
    "Unit 2 — Functions, relations and graphs",
    "Unit 2 — Algebra, number and structure",
    "Unit 2 — Calculus",
    "Unit 2 — Data analysis, probability and statistics",
  ],
  "general-maths": [
    "Statistics",
    "Measurement",
    "Finance",
    "Networks",
    "Matrices",
  ],
  "specialist-maths": [
    "Complex Numbers",
    "Calculus",
    "Vectors",
    "Proof",
  ],
};
