ALTER TABLE "attachments" ADD COLUMN "resource_id" text;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "scan_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attachments" ADD COLUMN "original_name" text;--> statement-breakpoint
CREATE FUNCTION protect_immutable_marketplace_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable marketplace evidence cannot be updated or deleted' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER listing_revisions_immutable BEFORE UPDATE OR DELETE ON listing_revisions FOR EACH ROW EXECUTE FUNCTION protect_immutable_marketplace_record();
--> statement-breakpoint
CREATE TRIGGER deal_terms_immutable BEFORE UPDATE OR DELETE ON deal_terms FOR EACH ROW EXECUTE FUNCTION protect_immutable_marketplace_record();
--> statement-breakpoint
CREATE TRIGGER deal_acceptances_immutable BEFORE UPDATE OR DELETE ON deal_acceptances FOR EACH ROW EXECUTE FUNCTION protect_immutable_marketplace_record();
--> statement-breakpoint
CREATE TRIGGER deal_events_immutable BEFORE UPDATE OR DELETE ON deal_events FOR EACH ROW EXECUTE FUNCTION protect_immutable_marketplace_record();
--> statement-breakpoint
CREATE TRIGGER domain_audit_events_immutable BEFORE UPDATE OR DELETE ON domain_audit_events FOR EACH ROW EXECUTE FUNCTION protect_immutable_marketplace_record();
--> statement-breakpoint
CREATE FUNCTION protect_sent_deal_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.state <> 'DRAFT' AND ROW(NEW.creator_id,NEW.respondent_id,NEW.payer_id,NEW.name,NEW.amount_cents,NEW.terms) IS DISTINCT FROM ROW(OLD.creator_id,OLD.respondent_id,OLD.payer_id,OLD.name,OLD.amount_cents,OLD.terms) THEN
    RAISE EXCEPTION 'Sent agreement terms are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER deals_protect_sent_terms BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION protect_sent_deal_terms();
