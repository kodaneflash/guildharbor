CREATE TABLE "announcements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "content" jsonb NOT NULL,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "pinned" boolean DEFAULT false NOT NULL,
  "important" boolean DEFAULT false NOT NULL,
  "published_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "removed_at" timestamp with time zone,
  CONSTRAINT "announcement_title_length" CHECK (char_length(btrim("title")) between 1 and 160)
);
--> statement-breakpoint
CREATE INDEX "announcement_discovery_idx" ON "announcements" ("pinned", "published_at", "id") WHERE "removed_at" IS NULL;
