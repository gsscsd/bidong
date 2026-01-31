CREATE TYPE "public"."actionType" AS ENUM('like', 'dislike', 'match', 'unmatch');--> statement-breakpoint
CREATE TABLE "daily_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"recommended_users" jsonb,
	"calculate_date" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "daily_recommendations_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "recommend_user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" text NOT NULL,
	"gender" smallint,
	"age" smallint,
	"height" smallint,
	"current_city" text,
	"marital_status" smallint,
	"education" smallint,
	"occupation" text,
	"annual_income" text,
	"embedding" vector(1024),
	"tag_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"l1_tag_ids" integer[] DEFAULT '{}'::integer[],
	"l2_tag_ids" integer[] DEFAULT '{}'::integer[],
	"l3_tag_ids" integer[] DEFAULT '{}'::integer[],
	"tags_snapshot" jsonb,
	"update_time" timestamp DEFAULT now(),
	CONSTRAINT "recommend_user_profiles_user_uuid_unique" UNIQUE("user_uuid")
);
--> statement-breakpoint
CREATE TABLE "tag_correlations" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_tag_id" integer NOT NULL,
	"target_id" integer NOT NULL,
	"weight" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "tag_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" smallint NOT NULL,
	"parent_id" integer,
	"category" text
);
--> statement-breakpoint
CREATE TABLE "user_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"actionType" "actionType",
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_blacklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_uuid" text NOT NULL,
	"recommend_count" smallint DEFAULT 20,
	"preferred_age_min" smallint DEFAULT 20,
	"preferred_age_max" smallint DEFAULT 45,
	"preferred_height_min" smallint DEFAULT 150,
	"preferred_height_max" smallint DEFAULT 200,
	"preferred_cities" text[] DEFAULT '{}'::text[],
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_uuid_unique" UNIQUE("user_uuid")
);
--> statement-breakpoint
CREATE INDEX "embedding_idx" ON "recommend_user_profiles" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "tags_gin_idx" ON "recommend_user_profiles" USING gin ("l3_tag_ids");