CREATE TABLE "upload_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"subject_id" text NOT NULL,
	"question_key" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "written_responses" ADD COLUMN "image_urls" text;--> statement-breakpoint
ALTER TABLE "upload_tokens" ADD CONSTRAINT "upload_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "upload_tokens_user_idx" ON "upload_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "upload_tokens_expires_idx" ON "upload_tokens" USING btree ("expires_at");