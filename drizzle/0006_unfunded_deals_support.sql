CREATE TABLE "deal_acceptances" (
	"deal_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"terms_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deal_acceptances_deal_id_user_id_pk" PRIMARY KEY("deal_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "deal_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"operation_id" uuid NOT NULL,
	"action" text NOT NULL,
	"resulting_state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_terms" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"terms" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"payer_id" text NOT NULL,
	"creator_id" text NOT NULL,
	"respondent_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"respondent_id" text,
	"payer_id" text,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"terms" text NOT NULL,
	"state" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"conversation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_conversation_id_unique" UNIQUE("conversation_id"),
	CONSTRAINT "deal_pre_funding_states" CHECK ("deals"."state" in ('DRAFT','PENDING_ACCEPTANCE','AWAITING_FUNDING','DECLINED','CANCELLED')),
	CONSTRAINT "deal_positive_amount" CHECK ("deals"."amount_cents" > 0),
	CONSTRAINT "deal_distinct_parties" CHECK ("deals"."respondent_id" is null or "deals"."creator_id" <> "deals"."respondent_id"),
	CONSTRAINT "deal_payer_party" CHECK ("deals"."payer_id" is null or "deals"."payer_id" = "deals"."creator_id" or "deals"."payer_id" = "deals"."respondent_id")
);
--> statement-breakpoint
CREATE TABLE "support_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" text NOT NULL,
	"deal_id" uuid,
	"conversation_id" uuid,
	"subject" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"assigned_to_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_state_valid" CHECK ("support_cases"."status" in ('open','in_review','resolved','closed'))
);
--> statement-breakpoint
CREATE TABLE "support_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deal_acceptances" ADD CONSTRAINT "deal_acceptances_deal_id_deal_terms_deal_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deal_terms"("deal_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_acceptances" ADD CONSTRAINT "deal_acceptances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_events" ADD CONSTRAINT "deal_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_terms" ADD CONSTRAINT "deal_terms_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_terms" ADD CONSTRAINT "deal_terms_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_terms" ADD CONSTRAINT "deal_terms_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_terms" ADD CONSTRAINT "deal_terms_respondent_id_users_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_respondent_id_users_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_to_id_users_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_events" ADD CONSTRAINT "support_events_case_id_support_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."support_cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_events" ADD CONSTRAINT "support_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_event_operation_unique" ON "deal_events" USING btree ("actor_id","operation_id");--> statement-breakpoint
CREATE INDEX "deal_creator_idx" ON "deals" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE INDEX "deal_respondent_idx" ON "deals" USING btree ("respondent_id","created_at");