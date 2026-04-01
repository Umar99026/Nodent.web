-- Create Friends tables for Neon (Cloudflare Pages backend)
-- Run this in Neon SQL editor once, then deploy.

CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS friend_requests_from_to_idx
  ON friend_requests(from_user_id, to_user_id);

CREATE INDEX IF NOT EXISTS friend_requests_to_status_idx
  ON friend_requests(to_user_id, status);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_low INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  CONSTRAINT friendships_user_low_user_high_unique UNIQUE(user_low, user_high)
);

CREATE INDEX IF NOT EXISTS friendships_user_low_idx
  ON friendships(user_low);

CREATE INDEX IF NOT EXISTS friendships_user_high_idx
  ON friendships(user_high);

CREATE TABLE IF NOT EXISTS friend_assignments (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  question_key TEXT NOT NULL,
  question_json TEXT NOT NULL,
  marks INTEGER NOT NULL DEFAULT 1,
  answer_json TEXT,
  is_correct INTEGER,
  created_at TEXT NOT NULL,
  answered_at TEXT
);

CREATE INDEX IF NOT EXISTS friend_assignments_pair_idx
  ON friend_assignments(from_user_id, to_user_id);

CREATE INDEX IF NOT EXISTS friend_assignments_to_answered_idx
  ON friend_assignments(to_user_id, answered_at);

