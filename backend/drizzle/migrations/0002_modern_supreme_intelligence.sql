ALTER TABLE "custom_questions" ADD COLUMN "topic" text DEFAULT 'General' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_questions" ADD COLUMN "image_urls" text;--> statement-breakpoint
ALTER TABLE "custom_questions" ADD COLUMN "answer_image_urls" text;--> statement-breakpoint
ALTER TABLE "custom_questions" ADD COLUMN "marks" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD COLUMN "marks" integer DEFAULT 1 NOT NULL;