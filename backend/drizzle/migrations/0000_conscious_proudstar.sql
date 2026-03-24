CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"username" text NOT NULL,
	"text" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"type" text NOT NULL,
	"question" text NOT NULL,
	"options" text,
	"answer" text,
	"accepted_answers" text,
	"guidance" text,
	"passage" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject_id" text NOT NULL,
	"question_key" text NOT NULL,
	"topic" text DEFAULT 'General' NOT NULL,
	"is_correct" integer NOT NULL,
	"answered_at" text NOT NULL,
	CONSTRAINT "question_attempts_unique" UNIQUE("user_id","subject_id","question_key")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject_id" text NOT NULL,
	"score" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"percent" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"question_key" text NOT NULL,
	"user_id" integer NOT NULL,
	"parent_comment_id" integer,
	"text" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"password_salt" text NOT NULL,
	"hash_algorithm" text DEFAULT 'pbkdf2' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "written_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject_id" text NOT NULL,
	"question_key" text NOT NULL,
	"response_text" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "written_responses_unique" UNIQUE("user_id","subject_id","question_key")
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_comments" ADD CONSTRAINT "quiz_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "written_responses" ADD CONSTRAINT "written_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_subject_created_idx" ON "chat_messages" USING btree ("subject_id","created_at");--> statement-breakpoint
CREATE INDEX "custom_questions_subject_idx" ON "custom_questions" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "question_attempts_subject_user_idx" ON "question_attempts" USING btree ("subject_id","user_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_subject_idx" ON "quiz_attempts" USING btree ("user_id","subject_id");--> statement-breakpoint
CREATE INDEX "quiz_comments_subject_question_idx" ON "quiz_comments" USING btree ("subject_id","question_key");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_email_lower_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "written_responses_subject_question_idx" ON "written_responses" USING btree ("subject_id","question_key");