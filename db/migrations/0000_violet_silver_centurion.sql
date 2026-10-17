CREATE TABLE "rate_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scores" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"name" text,
	"score" integer NOT NULL,
	"lap_ms" integer NOT NULL,
	"drift_ms" integer DEFAULT 0 NOT NULL,
	"jumps" integer DEFAULT 0 NOT NULL,
	"collisions" integer DEFAULT 0 NOT NULL,
	"build" text NOT NULL,
	"run_id" uuid NOT NULL,
	"ip_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scores_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE INDEX "rate_events_key_at_idx" ON "rate_events" USING btree ("key","at");--> statement-breakpoint
CREATE INDEX "scores_track_score_idx" ON "scores" USING btree ("track_id","score" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scores_device_idx" ON "scores" USING btree ("device_id");