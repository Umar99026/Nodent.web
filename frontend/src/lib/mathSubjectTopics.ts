/**
 * Google Sheets `topic` column: use ONE of these strings per row, exactly as written
 * (same spelling and spacing). The app matches this to filters and analytics.
 *
 * Replace or extend lists when you paste your official topic breakdowns.
 */
export const GOOGLE_SHEETS_TOPIC_LABELS: Record<string, readonly string[]> = {
  methods: [
    "Calculus",
    "Functions & Graphs",
    "Trigonometry",
    "Algebra",
    "Probability",
    "Functions",
    "Graphs",
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
