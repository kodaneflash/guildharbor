ALTER TYPE "public"."conversation_type" ADD VALUE 'deal';--> statement-breakpoint
ALTER TYPE "public"."conversation_type" ADD VALUE 'order';--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" bigint NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"last_error" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_outbox_notification_id_unique" UNIQUE("notification_id"),
	CONSTRAINT "outbox_status_valid" CHECK ("notification_outbox"."status" in ('pending','processing','delivered','skipped','failed'))
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"email" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_id_event_type_pk" PRIMARY KEY("user_id","event_type")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "resource_type" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "resource_id" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "event_key" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD CONSTRAINT "notification_outbox_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "notification_outbox" USING btree ("status","available_at");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_event_key_unique" UNIQUE("event_key");