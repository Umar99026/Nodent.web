-- Mark scheme steps per question (VCAA-style breakdown)
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS mark_breakdown_json text;

-- Per-subject AI marking context (prompt + reference resources)
CREATE TABLE IF NOT EXISTS subject_marking_context (
  subject_id text PRIMARY KEY,
  prompt_text text NOT NULL DEFAULT '',
  resources_json text NOT NULL DEFAULT '[]',
  updated_at text NOT NULL
);
