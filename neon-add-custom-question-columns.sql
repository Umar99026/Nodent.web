-- Run once against Neon if admin/quiz features error on missing columns.
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT 'General';
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS image_urls TEXT;
ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS marks INTEGER NOT NULL DEFAULT 1;
