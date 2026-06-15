-- Prevent duplicate question stems per subject (normalized: trim + collapse whitespace + lower).
-- Run after dedupe-custom-questions.mjs --apply if duplicates exist.
CREATE UNIQUE INDEX IF NOT EXISTS custom_questions_subject_stem_unique
ON custom_questions (
  LOWER(TRIM(subject_id)),
  LOWER(REGEXP_REPLACE(TRIM(question), '\s+', ' ', 'g'))
);
