-- Run once on Neon so subject forum (Chat page) create/list/reply works on Cloudflare.
CREATE TABLE IF NOT EXISTS forum_posts (
  id SERIAL PRIMARY KEY,
  subject_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_urls TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_subject_updated
  ON forum_posts (subject_id, updated_at);

CREATE TABLE IF NOT EXISTS forum_replies (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
  subject_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forum_replies_post_created
  ON forum_replies (post_id, created_at);
