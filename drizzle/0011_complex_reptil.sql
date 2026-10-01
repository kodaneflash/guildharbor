CREATE TABLE "financial_command_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "financial_command_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"command_id" uuid NOT NULL,
	"state" text NOT NULL,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_command_event_state" CHECK ("financial_command_events"."state" in ('prepared','outcome_unknown','identified'))
);
--> statement-breakpoint
ALTER TABLE "financial_command_events" ADD CONSTRAINT "financial_command_events_command_id_financial_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."financial_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_command_event_idx" ON "financial_command_events" USING btree ("command_id","id");
--> statement-breakpoint
CREATE TRIGGER financial_command_events_immutable BEFORE UPDATE OR DELETE ON financial_command_events
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_command_events_no_truncate BEFORE TRUNCATE ON financial_command_events
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE FUNCTION financial_record_command_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO financial_command_events (command_id,state,provider_id) VALUES (NEW.id,NEW.state,NEW.provider_id);
  ELSIF ROW(OLD.state,OLD.provider_id) IS DISTINCT FROM ROW(NEW.state,NEW.provider_id) THEN
    INSERT INTO financial_command_events (command_id,state,provider_id) VALUES (NEW.id,NEW.state,NEW.provider_id);
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_commands_record_transition AFTER INSERT OR UPDATE ON financial_commands
FOR EACH ROW EXECUTE FUNCTION financial_record_command_transition();
