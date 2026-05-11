-- Run on Neon if admin "add question" fails with invalid input syntax for integer,
-- i.e. custom_questions.subject_id was created as INTEGER but the app sends TEXT ids (e.g. "english").
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'custom_questions'
      AND column_name = 'subject_id'
      AND udt_name NOT IN ('text', 'varchar', 'bpchar')
  ) THEN
    ALTER TABLE custom_questions
      ALTER COLUMN subject_id TYPE TEXT USING subject_id::text;
  END IF;
END $$;
