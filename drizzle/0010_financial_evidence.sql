CREATE TABLE "financial_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"request_digest" text NOT NULL,
	"state" text DEFAULT 'prepared' NOT NULL,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_commands_provider_id_unique" UNIQUE("kind","provider_id"),
	CONSTRAINT "financial_command_kind" CHECK ("financial_commands"."kind" in ('deposit','withdrawal')),
	CONSTRAINT "financial_command_digest" CHECK ("financial_commands"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "financial_command_state" CHECK ("financial_commands"."state" in ('prepared','outcome_unknown','identified')),
	CONSTRAINT "financial_command_provider_state" CHECK (("financial_commands"."state" = 'identified') = ("financial_commands"."provider_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "financial_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"command_id" uuid,
	"source" text NOT NULL,
	"digest" text NOT NULL,
	"encrypted_body" text NOT NULL,
	"key_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_evidence_source" CHECK ("financial_evidence"."source" in ('ipn','lookup','command')),
	CONSTRAINT "financial_evidence_digest" CHECK ("financial_evidence"."digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "financial_commands" ADD CONSTRAINT "financial_commands_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_evidence" ADD CONSTRAINT "financial_evidence_command_id_financial_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."financial_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_command_request_unique" ON "financial_commands" USING btree ("owner_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_evidence_unique" ON "financial_evidence" USING btree ("source","digest");--> statement-breakpoint
CREATE INDEX "financial_evidence_command_idx" ON "financial_evidence" USING btree ("command_id","created_at");
--> statement-breakpoint
CREATE TRIGGER financial_evidence_immutable BEFORE UPDATE OR DELETE ON financial_evidence
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_evidence_no_truncate BEFORE TRUNCATE ON financial_evidence
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_commands_no_delete BEFORE DELETE ON financial_commands
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_commands_no_truncate BEFORE TRUNCATE ON financial_commands
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE FUNCTION financial_command_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.id,OLD.owner_id,OLD.request_id,OLD.kind,OLD.request_digest,OLD.created_at)
     IS DISTINCT FROM ROW(NEW.id,NEW.owner_id,NEW.request_id,NEW.kind,NEW.request_digest,NEW.created_at) THEN
    RAISE EXCEPTION 'Financial command instructions are immutable';
  END IF;
  IF OLD.state = 'prepared' AND NEW.state = 'outcome_unknown' THEN RETURN NEW; END IF;
  IF OLD.state = 'outcome_unknown' AND NEW.state = 'identified' THEN RETURN NEW; END IF;
  IF ROW(OLD.state,OLD.provider_id) IS NOT DISTINCT FROM ROW(NEW.state,NEW.provider_id) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Financial command transition requires reconciliation; submission cannot be retried';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_commands_transition BEFORE UPDATE ON financial_commands
FOR EACH ROW EXECUTE FUNCTION financial_command_transition();
