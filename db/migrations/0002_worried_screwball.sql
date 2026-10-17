CREATE TABLE "ghosts" (
	"track_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"score" integer NOT NULL,
	"lap_ms" integer NOT NULL,
	"data" text NOT NULL,
	"build" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ghosts_track_id_device_id_pk" PRIMARY KEY("track_id","device_id")
);
--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "score_time" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "score_style" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "total_ms" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ADD COLUMN "result" jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX "ghosts_track_score_idx" ON "ghosts" USING btree ("track_id","score" DESC NULLS LAST);