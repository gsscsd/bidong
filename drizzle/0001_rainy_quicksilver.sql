CREATE TABLE "tag_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_name" text,
	"standard_tag_id" integer,
	CONSTRAINT "tag_aliases_raw_name_unique" UNIQUE("raw_name")
);
--> statement-breakpoint
ALTER TABLE "tag_correlations" RENAME COLUMN "target_id" TO "target_tag_id";--> statement-breakpoint
ALTER TABLE "tag_correlations" RENAME COLUMN "weight" TO "semantic_weight";--> statement-breakpoint
ALTER TABLE "recommend_user_profiles" ADD COLUMN "last_login_time" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "recommend_user_profiles" ADD COLUMN "last_active_time" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "recommend_user_profiles" ADD COLUMN "is_vip" smallint DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tag_correlations" ADD COLUMN "co_occurrence_weight" real;--> statement-breakpoint
ALTER TABLE "tag_correlations" ADD COLUMN "final_weight" real;--> statement-breakpoint
ALTER TABLE "tag_definitions" ADD COLUMN "is_standard" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tag_definitions" ADD COLUMN "embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "tag_definitions" ADD COLUMN "usage_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tag_definitions" ADD COLUMN "status" smallint DEFAULT 1;--> statement-breakpoint
ALTER TABLE "tag_aliases" ADD CONSTRAINT "tag_aliases_standard_tag_id_tag_definitions_id_fk" FOREIGN KEY ("standard_tag_id") REFERENCES "public"."tag_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tag_embedding_idx" ON "tag_definitions" USING hnsw ("embedding" vector_cosine_ops);