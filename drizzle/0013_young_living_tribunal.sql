CREATE TABLE "financial_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"event_key" text NOT NULL,
	"kind" text NOT NULL,
	"resource_id" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_activity_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "financial_deposits" (
	"command_id" uuid PRIMARY KEY NOT NULL,
	"currency" text NOT NULL,
	"address" text NOT NULL,
	"memo" text,
	"requested_atoms" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"detected_at" timestamp with time zone,
	"status" text DEFAULT 'awaiting_payment' NOT NULL,
	"credited_journal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_deposits_credited_journal_id_unique" UNIQUE("credited_journal_id"),
	CONSTRAINT "financial_deposit_positive" CHECK ("financial_deposits"."requested_atoms" > 0)
);
--> statement-breakpoint
CREATE TABLE "financial_freezes" (
	"member_id" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"payment_journal_id" uuid NOT NULL,
	"status" text NOT NULL,
	"hold_until" timestamp with time zone NOT NULL,
	"settled_journal_id" uuid,
	"refund_journal_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_orders_quote_id_unique" UNIQUE("quote_id"),
	CONSTRAINT "financial_orders_payment_journal_id_unique" UNIQUE("payment_journal_id"),
	CONSTRAINT "financial_orders_settled_journal_id_unique" UNIQUE("settled_journal_id"),
	CONSTRAINT "financial_orders_refund_journal_id_unique" UNIQUE("refund_journal_id"),
	CONSTRAINT "financial_order_state" CHECK ("financial_orders"."status" in ('paid','completed','disputed','refunded'))
);
--> statement-breakpoint
CREATE TABLE "financial_purchase_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_id" text NOT NULL,
	"seller_id" text NOT NULL,
	"revision_id" uuid NOT NULL,
	"amount_atoms" bigint NOT NULL,
	"policy_version" text NOT NULL,
	"evidence_reference" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_quote_positive" CHECK ("financial_purchase_quotes"."amount_atoms" > 0),
	CONSTRAINT "financial_quote_parties" CHECK ("financial_purchase_quotes"."buyer_id" <> "financial_purchase_quotes"."seller_id")
);
--> statement-breakpoint
ALTER TABLE "financial_activity" ADD CONSTRAINT "financial_activity_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_activity" ADD CONSTRAINT "financial_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD CONSTRAINT "financial_deposits_command_id_financial_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."financial_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD CONSTRAINT "financial_deposits_credited_journal_id_financial_journals_id_fk" FOREIGN KEY ("credited_journal_id") REFERENCES "public"."financial_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_freezes" ADD CONSTRAINT "financial_freezes_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_orders" ADD CONSTRAINT "financial_orders_quote_id_financial_purchase_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."financial_purchase_quotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_orders" ADD CONSTRAINT "financial_orders_payment_journal_id_financial_journals_id_fk" FOREIGN KEY ("payment_journal_id") REFERENCES "public"."financial_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_orders" ADD CONSTRAINT "financial_orders_settled_journal_id_financial_journals_id_fk" FOREIGN KEY ("settled_journal_id") REFERENCES "public"."financial_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_orders" ADD CONSTRAINT "financial_orders_refund_journal_id_financial_journals_id_fk" FOREIGN KEY ("refund_journal_id") REFERENCES "public"."financial_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_purchase_quotes" ADD CONSTRAINT "financial_purchase_quotes_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_purchase_quotes" ADD CONSTRAINT "financial_purchase_quotes_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_purchase_quotes" ADD CONSTRAINT "financial_purchase_quotes_revision_id_listing_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."listing_revisions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_activity_member_idx" ON "financial_activity" USING btree ("member_id","created_at");
--> statement-breakpoint
CREATE TRIGGER financial_activity_immutable BEFORE UPDATE OR DELETE ON financial_activity
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_activity_no_truncate BEFORE TRUNCATE ON financial_activity
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_quotes_immutable BEFORE UPDATE OR DELETE ON financial_purchase_quotes
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_quotes_no_truncate BEFORE TRUNCATE ON financial_purchase_quotes
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
