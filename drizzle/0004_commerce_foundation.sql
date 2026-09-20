CREATE TABLE "cart_items" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"added_price_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"user_id" text PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legacy_listing_imports" (
	"legacy_thread_id" bigint PRIMARY KEY NOT NULL,
	"listing_id" uuid,
	"source_record" jsonb NOT NULL,
	"source_checksum" text NOT NULL,
	"status" text DEFAULT 'needs_review' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_favorites" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
CREATE TABLE "listing_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"price_cents" integer NOT NULL,
	"fulfillment_mode" text NOT NULL,
	"delivery_terms" text NOT NULL,
	"protected_text" text,
	"protected_file_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revision_positive_price" CHECK ("listing_revisions"."price_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" text NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"fulfillment_mode" text NOT NULL,
	"delivery_terms" text NOT NULL,
	"price_cents" integer NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_positive_price" CHECK ("listings"."price_cents" > 0),
	CONSTRAINT "listing_kind_valid" CHECK ("listings"."kind" in ('digital','service')),
	CONSTRAINT "listing_fulfillment_valid" CHECK ("listings"."fulfillment_mode" in ('text','file','manual')),
	CONSTRAINT "listing_status_valid" CHECK ("listings"."status" in ('draft','published','paused','archived','removed')),
	CONSTRAINT "listing_version_positive" CHECK ("listings"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "marketplace_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "marketplace_category_not_self" CHECK ("marketplace_categories"."parent_id" is null or "marketplace_categories"."parent_id" <> "marketplace_categories"."id")
);
--> statement-breakpoint
CREATE TABLE "seller_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"policy_version" text NOT NULL,
	"policy_accepted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_status_valid" CHECK ("seller_profiles"."status" in ('active','suspended','closed'))
);
--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_carts_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."carts"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_audit_events" ADD CONSTRAINT "domain_audit_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_listing_imports" ADD CONSTRAINT "legacy_listing_imports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_favorites" ADD CONSTRAINT "listing_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_favorites" ADD CONSTRAINT "listing_favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "listing_revisions_protected_file_id_attachments_id_fk" FOREIGN KEY ("protected_file_id") REFERENCES "public"."attachments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_seller_id_seller_profiles_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."seller_profiles"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_marketplace_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_categories" ADD CONSTRAINT "marketplace_categories_parent_id_marketplace_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."marketplace_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "domain_audit_resource_idx" ON "domain_audit_events" USING btree ("resource_type","resource_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_revision_unique" ON "listing_revisions" USING btree ("listing_id","version");--> statement-breakpoint
CREATE INDEX "listing_discovery_idx" ON "listings" USING btree ("status","category_id","created_at");--> statement-breakpoint
CREATE INDEX "listing_seller_idx" ON "listings" USING btree ("seller_id","id");