CREATE TABLE "search_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"searched_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"query" text PRIMARY KEY NOT NULL,
	"count" bigint DEFAULT 0 NOT NULL,
	"recent_count" double precision DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
