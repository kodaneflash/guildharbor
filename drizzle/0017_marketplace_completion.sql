ALTER TABLE financial_commands ADD COLUMN next_check_at timestamptz NOT NULL DEFAULT now();
--> statement-breakpoint
ALTER TABLE financial_deposit_requests
  ADD COLUMN asset text NOT NULL DEFAULT 'USDC',
  ADD COLUMN network text NOT NULL DEFAULT 'base',
  ADD COLUMN decimals integer NOT NULL DEFAULT 6 CHECK (decimals BETWEEN 0 AND 18),
  ADD COLUMN token_contract text DEFAULT '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  ADD COLUMN memo_required boolean NOT NULL DEFAULT false,
  ADD COLUMN settlement_currency text;
--> statement-breakpoint
ALTER TABLE financial_deposits
  ADD COLUMN asset text NOT NULL DEFAULT 'USDC',
  ADD COLUMN network text NOT NULL DEFAULT 'base',
  ADD COLUMN decimals integer NOT NULL DEFAULT 6 CHECK (decimals BETWEEN 0 AND 18),
  ADD COLUMN settlement_currency text;
--> statement-breakpoint
-- NULL settlement currency preserves historical same-asset requests without
-- updating their immutable records. New requests always set the verified asset.
ALTER TABLE financial_deposits DROP CONSTRAINT financial_deposit_amounts;
--> statement-breakpoint
ALTER TABLE financial_deposits ADD CONSTRAINT financial_deposit_amounts CHECK (
  (minimum_atoms IS NULL OR minimum_atoms > 0) AND
  (estimated_net_atoms IS NULL OR estimated_net_atoms > 0 AND
    (currency <> coalesce(settlement_currency,currency) OR estimated_net_atoms <= requested_atoms)) AND
  ((credited_journal_id IS NULL AND settled_atoms IS NULL AND payin_hash IS NULL) OR
   (credited_journal_id IS NOT NULL AND settled_atoms > 0 AND settled_atoms IS NOT NULL AND payin_hash IS NOT NULL AND
    (currency <> coalesce(settlement_currency,currency) OR settled_atoms <= requested_atoms)))
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION financial_deposit_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.command_id,OLD.currency,OLD.asset,OLD.network,OLD.decimals,OLD.settlement_currency,
      OLD.address,OLD.memo,OLD.requested_atoms,OLD.minimum_atoms,OLD.estimated_net_atoms,OLD.price_usd,OLD.expires_at,OLD.created_at)
    IS DISTINCT FROM ROW(NEW.command_id,NEW.currency,NEW.asset,NEW.network,NEW.decimals,NEW.settlement_currency,
      NEW.address,NEW.memo,NEW.requested_atoms,NEW.minimum_atoms,NEW.estimated_net_atoms,NEW.price_usd,NEW.expires_at,NEW.created_at) THEN
    RAISE EXCEPTION 'Deposit instructions are immutable';
  END IF;
  IF OLD.credited_journal_id IS NOT NULL AND ROW(OLD.credited_journal_id,OLD.settled_atoms,OLD.payin_hash)
    IS DISTINCT FROM ROW(NEW.credited_journal_id,NEW.settled_atoms,NEW.payin_hash) THEN
    RAISE EXCEPTION 'Deposit credit cannot be rewritten';
  END IF;
  IF NEW.credited_journal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_journals j JOIN financial_accounts d ON d.id = j.debit_account_id
    JOIN financial_accounts c ON c.id = j.credit_account_id JOIN financial_commands cmd ON cmd.id = NEW.command_id
    WHERE j.id = NEW.credited_journal_id AND j.kind = 'deposit' AND j.reference = 'deposit:' || NEW.command_id::text
      AND j.amount_atoms = NEW.settled_atoms AND d.kind = 'backing' AND c.kind = 'available' AND c.owner_id = cmd.owner_id
  ) THEN RAISE EXCEPTION 'Deposit credit does not match its journal'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TABLE financial_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), buyer_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL, request_digest text NOT NULL CHECK (request_digest ~ '^[0-9a-f]{64}$'),
  from_cart boolean NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX financial_checkout_request_unique ON financial_checkouts(buyer_id,request_id);
--> statement-breakpoint
ALTER TABLE financial_purchase_quotes ADD COLUMN checkout_id uuid REFERENCES financial_checkouts(id) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE UNIQUE INDEX financial_checkout_revision_unique ON financial_purchase_quotes(checkout_id,revision_id);
--> statement-breakpoint
CREATE TABLE financial_ipn_receipts (
  evidence_id uuid PRIMARY KEY REFERENCES financial_evidence(id) ON DELETE RESTRICT,
  next_check_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
--> statement-breakpoint
-- Recover any callbacks retained before this migration as well as new receipts.
INSERT INTO financial_ipn_receipts(evidence_id) SELECT id FROM financial_evidence WHERE source = 'ipn';
--> statement-breakpoint
CREATE TABLE financial_fulfillments (
  order_id uuid PRIMARY KEY REFERENCES financial_orders(id) ON DELETE RESTRICT,
  seller_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  protected_text text NOT NULL, content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TRIGGER financial_checkouts_immutable BEFORE UPDATE OR DELETE ON financial_checkouts
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_checkouts_no_truncate BEFORE TRUNCATE ON financial_checkouts
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_fulfillments_immutable BEFORE UPDATE OR DELETE ON financial_fulfillments
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_fulfillments_no_truncate BEFORE TRUNCATE ON financial_fulfillments
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE FUNCTION financial_order_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF ROW(OLD.id,OLD.quote_id,OLD.payment_journal_id,OLD.hold_until,OLD.created_at)
      IS DISTINCT FROM ROW(NEW.id,NEW.quote_id,NEW.payment_journal_id,NEW.hold_until,NEW.created_at) OR
      OLD.settled_journal_id IS NOT NULL AND OLD.settled_journal_id IS DISTINCT FROM NEW.settled_journal_id THEN
      RAISE EXCEPTION 'Committed order identity and settlement are immutable';
    END IF;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM financial_purchase_quotes q JOIN financial_journals j ON j.id = NEW.payment_journal_id
    JOIN financial_accounts d ON d.id = j.debit_account_id JOIN financial_accounts c ON c.id = j.credit_account_id
    WHERE q.id = NEW.quote_id AND j.reference = 'purchase:' || q.id::text AND j.kind = 'purchase'
      AND j.amount_atoms = q.amount_atoms AND d.kind = 'available' AND d.owner_id = q.buyer_id
      AND c.kind = 'pending' AND c.owner_id = q.seller_id AND NEW.hold_until >= j.created_at + interval '24 hours'
  ) THEN RAISE EXCEPTION 'Order does not match its committed purchase'; END IF;
  IF NEW.settled_journal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM financial_purchase_quotes q JOIN financial_journals j ON j.id = NEW.settled_journal_id
    JOIN financial_accounts d ON d.id = j.debit_account_id JOIN financial_accounts c ON c.id = j.credit_account_id
    WHERE q.id = NEW.quote_id AND j.reference = 'settlement:' || NEW.id::text AND j.kind = 'settlement'
      AND j.amount_atoms = q.amount_atoms AND d.kind = 'pending' AND c.kind = 'available'
      AND d.owner_id = q.seller_id AND c.owner_id = q.seller_id
      AND j.created_at >= NEW.hold_until AND NEW.status IN ('paid','completed') AND NEW.refund_journal_id IS NULL
  ) THEN RAISE EXCEPTION 'Seller settlement does not match its matured order'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_orders_integrity BEFORE INSERT OR UPDATE ON financial_orders
FOR EACH ROW EXECUTE FUNCTION financial_order_integrity();
--> statement-breakpoint
CREATE TRIGGER financial_orders_no_delete BEFORE DELETE ON financial_orders
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_orders_no_truncate BEFORE TRUNCATE ON financial_orders
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE FUNCTION financial_checkout_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE checkout uuid; expected integer; committed integer;
BEGIN
  SELECT checkout_id INTO checkout FROM financial_purchase_quotes WHERE id = NEW.quote_id;
  IF checkout IS NULL THEN RETURN NULL; END IF;
  SELECT count(*),count(o.id) INTO expected,committed FROM financial_purchase_quotes q
    LEFT JOIN financial_orders o ON o.quote_id = q.id WHERE q.checkout_id = checkout;
  IF committed <> expected THEN RAISE EXCEPTION 'Checkout must commit every quoted product atomically'; END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER financial_checkout_complete AFTER INSERT ON financial_orders
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION financial_checkout_integrity();
--> statement-breakpoint
CREATE FUNCTION financial_fulfillment_integrity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM financial_orders o JOIN financial_purchase_quotes q ON q.id = o.quote_id
    JOIN listing_revisions r ON r.id = q.revision_id WHERE o.id = NEW.order_id AND q.seller_id = NEW.seller_id
      AND r.fulfillment_mode = 'manual' AND o.status IN ('paid','completed') AND o.refund_journal_id IS NULL)
  THEN RAISE EXCEPTION 'Fulfillment requires an owned paid manual order'; END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_fulfillments_integrity BEFORE INSERT ON financial_fulfillments
FOR EACH ROW EXECUTE FUNCTION financial_fulfillment_integrity();
--> statement-breakpoint
CREATE INDEX financial_order_hold_idx ON financial_orders(hold_until) WHERE settled_journal_id IS NULL;
--> statement-breakpoint
CREATE INDEX financial_command_recovery_idx ON financial_commands(next_check_at) WHERE state = 'outcome_unknown';
--> statement-breakpoint
CREATE INDEX financial_ipn_recovery_idx ON financial_ipn_receipts(next_check_at) WHERE processed_at IS NULL;
