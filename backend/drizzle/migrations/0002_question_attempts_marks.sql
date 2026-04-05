ALTER TABLE "question_attempts" ADD COLUMN IF NOT EXISTS "marks" integer DEFAULT 1 NOT NULL;
