CREATE TABLE "recommendation_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_user_id" text NOT NULL,
	"score" double precision NOT NULL,
	"is_priority" boolean DEFAULT false,
	"tags" text[] DEFAULT '{}'::text[],
	"reason" text DEFAULT '',
	"status" smallint DEFAULT 0 NOT NULL,
	"batch_date" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "unique_user_target_pair" UNIQUE("user_id","target_user_id")
);
--> statement-breakpoint
ALTER TABLE "recommend_user_profiles" ADD COLUMN "self_tags" integer[] DEFAULT '{}'::integer[];--> statement-breakpoint
ALTER TABLE "recommend_user_profiles" ADD COLUMN "partner_tags" integer[] DEFAULT '{}'::integer[];--> statement-breakpoint
CREATE INDEX "rec_queue_fetch_idx" ON "recommendation_queue" USING btree ("user_id","status","score");