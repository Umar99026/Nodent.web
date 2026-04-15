CREATE TABLE IF NOT EXISTS "peer_response_ratings" (
	"id" serial PRIMARY KEY NOT NULL,
	"rater_user_id" integer NOT NULL,
	"subject_id" text NOT NULL,
	"question_key" text NOT NULL,
	"target_user_id" integer NOT NULL,
	"score" integer NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "peer_response_ratings" ADD CONSTRAINT "peer_response_ratings_rater_user_id_users_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "peer_response_ratings" ADD CONSTRAINT "peer_response_ratings_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "peer_response_ratings" ADD CONSTRAINT "peer_response_ratings_unique" UNIQUE("rater_user_id","subject_id","question_key","target_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "peer_response_ratings_target_idx" ON "peer_response_ratings" ("subject_id","question_key","target_user_id");
