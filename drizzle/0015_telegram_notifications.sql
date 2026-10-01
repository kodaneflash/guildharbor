CREATE TABLE "telegram_connections" (
	"user_id" text PRIMARY KEY NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"private_chat_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_connections_telegram_user_id_unique" UNIQUE("telegram_user_id")
);
--> statement-breakpoint
CREATE TABLE "telegram_link_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_link_tokens_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "telegram_outbox" (
	"notification_id" bigint PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "telegram_outbox_status_valid" CHECK ("telegram_outbox"."status" in ('pending','claimed','delivered','skipped','failed'))
);
--> statement-breakpoint
CREATE TABLE "telegram_preferences" (
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "telegram_preferences_user_id_event_type_pk" PRIMARY KEY("user_id","event_type")
);
--> statement-breakpoint
ALTER TABLE "telegram_connections" ADD CONSTRAINT "telegram_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD CONSTRAINT "telegram_link_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_outbox" ADD CONSTRAINT "telegram_outbox_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_preferences" ADD CONSTRAINT "telegram_preferences_user_id_telegram_connections_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."telegram_connections"("user_id") ON DELETE cascade ON UPDATE no action;