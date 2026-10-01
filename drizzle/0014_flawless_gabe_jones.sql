CREATE TABLE "financial_deposit_requests" (
	"command_id" uuid PRIMARY KEY NOT NULL,
	"price_usd" text NOT NULL,
	"currency" text NOT NULL,
	"minimum_atoms" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_deposit_request_minimum" CHECK ("financial_deposit_requests"."minimum_atoms" > 0)
);
--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD COLUMN "minimum_atoms" bigint;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD COLUMN "estimated_net_atoms" bigint;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD COLUMN "price_usd" text;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD COLUMN "settled_atoms" bigint;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD COLUMN "payin_hash" text;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD COLUMN "next_check_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_deposit_requests" ADD CONSTRAINT "financial_deposit_requests_command_id_financial_commands_id_fk" FOREIGN KEY ("command_id") REFERENCES "public"."financial_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_deposits" ADD CONSTRAINT "financial_deposits_payin_hash_unique" UNIQUE("payin_hash");
--> statement-breakpoint
CREATE TRIGGER financial_deposit_requests_immutable BEFORE UPDATE OR DELETE ON financial_deposit_requests
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_deposit_requests_no_truncate BEFORE TRUNCATE ON financial_deposit_requests
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_deposits_no_delete BEFORE DELETE ON financial_deposits
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_deposits_no_truncate BEFORE TRUNCATE ON financial_deposits
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
ALTER TABLE financial_deposits ADD CONSTRAINT financial_deposit_amounts CHECK (
  (minimum_atoms IS NULL OR minimum_atoms > 0) AND
  (estimated_net_atoms IS NULL OR estimated_net_atoms > 0 AND estimated_net_atoms <= requested_atoms) AND
  ((credited_journal_id IS NULL AND settled_atoms IS NULL AND payin_hash IS NULL) OR
   (credited_journal_id IS NOT NULL AND settled_atoms IS NOT NULL AND settled_atoms > 0 AND settled_atoms <= requested_atoms AND payin_hash IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE financial_deposits ADD CONSTRAINT financial_deposit_status CHECK (
  status IN ('awaiting_payment','detected','confirming','eligible_for_reconciliation','completed','expired',
    'partial_payment','overpayment','late_payment','failed_payment','wrong_asset_or_network','manual_review') AND
  (status <> 'completed' OR credited_journal_id IS NOT NULL)
);
--> statement-breakpoint
CREATE FUNCTION financial_deposit_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.command_id,OLD.currency,OLD.address,OLD.memo,OLD.requested_atoms,OLD.minimum_atoms,
      OLD.estimated_net_atoms,OLD.price_usd,OLD.expires_at,OLD.created_at)
    IS DISTINCT FROM ROW(NEW.command_id,NEW.currency,NEW.address,NEW.memo,NEW.requested_atoms,NEW.minimum_atoms,
      NEW.estimated_net_atoms,NEW.price_usd,NEW.expires_at,NEW.created_at) THEN
    RAISE EXCEPTION 'Deposit instructions are immutable';
  END IF;
  IF OLD.credited_journal_id IS NOT NULL AND ROW(OLD.credited_journal_id,OLD.settled_atoms,OLD.payin_hash)
    IS DISTINCT FROM ROW(NEW.credited_journal_id,NEW.settled_atoms,NEW.payin_hash) THEN
    RAISE EXCEPTION 'Deposit credit cannot be rewritten';
  END IF;
  IF NEW.credited_journal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_journals j
    JOIN financial_accounts d ON d.id = j.debit_account_id
    JOIN financial_accounts c ON c.id = j.credit_account_id
    JOIN financial_commands cmd ON cmd.id = NEW.command_id
    WHERE j.id = NEW.credited_journal_id AND j.kind = 'deposit' AND
      j.reference = 'deposit:' || NEW.command_id::text AND j.amount_atoms = NEW.settled_atoms AND
      d.kind = 'backing' AND c.kind = 'available' AND c.owner_id = cmd.owner_id
  ) THEN RAISE EXCEPTION 'Deposit credit does not match its journal'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_deposits_transition BEFORE UPDATE ON financial_deposits
FOR EACH ROW EXECUTE FUNCTION financial_deposit_transition();
--> statement-breakpoint
CREATE UNIQUE INDEX financial_deposit_address_unique ON financial_deposits (currency, lower(address));
--> statement-breakpoint
CREATE INDEX financial_deposit_recovery_idx ON financial_deposits (next_check_at);
