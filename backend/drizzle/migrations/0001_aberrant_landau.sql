CREATE TABLE "friend_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"subject_id" text NOT NULL,
	"question_key" text NOT NULL,
	"question_json" text NOT NULL,
	"marks" integer DEFAULT 1 NOT NULL,
	"answer_json" text,
	"is_correct" integer,
	"created_at" text NOT NULL,
	"answered_at" text
);
--> statement-breakpoint
CREATE TABLE "friend_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_low" integer NOT NULL,
	"user_high" integer NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "friendships_user_low_user_high_unique" UNIQUE("user_low","user_high")
);
--> statement-breakpoint
ALTER TABLE "friend_assignments" ADD CONSTRAINT "friend_assignments_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_assignments" ADD CONSTRAINT "friend_assignments_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friend_requests" ADD CONSTRAINT "friend_requests_to_user_id_users_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_low_users_id_fk" FOREIGN KEY ("user_low") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_user_high_users_id_fk" FOREIGN KEY ("user_high") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "friend_assignments_pair_idx" ON "friend_assignments" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "friend_assignments_to_answered_idx" ON "friend_assignments" USING btree ("to_user_id","answered_at");--> statement-breakpoint
CREATE INDEX "friend_requests_from_to_idx" ON "friend_requests" USING btree ("from_user_id","to_user_id");--> statement-breakpoint
CREATE INDEX "friend_requests_to_status_idx" ON "friend_requests" USING btree ("to_user_id","status");--> statement-breakpoint
CREATE INDEX "friendships_user_low_idx" ON "friendships" USING btree ("user_low");--> statement-breakpoint
CREATE INDEX "friendships_user_high_idx" ON "friendships" USING btree ("user_high");