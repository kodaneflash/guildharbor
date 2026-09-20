ALTER TABLE "profiles" ADD COLUMN "discord_handle" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "show_telegram" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "show_discord" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "show_last_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "preferred_contact" text DEFAULT 'any' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_locale_valid" CHECK ("profiles"."locale" = 'en');--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_preferred_contact_valid" CHECK ("profiles"."preferred_contact" in ('email', 'telegram', 'discord', 'any'));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_contact_configured" CHECK (("profiles"."preferred_contact" <> 'telegram' or nullif("profiles"."telegram_handle", '') is not null) and ("profiles"."preferred_contact" <> 'discord' or nullif("profiles"."discord_handle", '') is not null));