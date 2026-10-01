CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"kind" text NOT NULL,
	"currency" text DEFAULT 'USDC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_account_currency" CHECK ("financial_accounts"."currency" = 'USDC'),
	CONSTRAINT "financial_account_owner" CHECK (("financial_accounts"."owner_id" is not null and "financial_accounts"."kind" in ('available','pending','reserved')) or ("financial_accounts"."owner_id" is null and "financial_accounts"."kind" = 'backing'))
);
--> statement-breakpoint
CREATE TABLE "financial_journals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"debit_account_id" uuid NOT NULL,
	"credit_account_id" uuid NOT NULL,
	"amount_atoms" bigint NOT NULL,
	"kind" text NOT NULL,
	"actor_id" text NOT NULL,
	"evidence_reference" text NOT NULL,
	"reversal_of_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_journals_reference_unique" UNIQUE("reference"),
	CONSTRAINT "financial_journal_positive" CHECK ("financial_journals"."amount_atoms" > 0),
	CONSTRAINT "financial_journal_distinct" CHECK ("financial_journals"."debit_account_id" <> "financial_journals"."credit_account_id"),
	CONSTRAINT "financial_journal_reference" CHECK (length("financial_journals"."reference") between 1 and 200 and length("financial_journals"."evidence_reference") between 1 and 200),
	CONSTRAINT "financial_journal_kind" CHECK ("financial_journals"."kind" in ('deposit','purchase','reservation','escrow','settlement','refund','adjustment','withdrawal'))
);
--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_journals" ADD CONSTRAINT "financial_journals_debit_account_id_financial_accounts_id_fk" FOREIGN KEY ("debit_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_journals" ADD CONSTRAINT "financial_journals_credit_account_id_financial_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."financial_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_journals" ADD CONSTRAINT "financial_journals_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_journals" ADD CONSTRAINT "financial_journals_reversal_of_id_financial_journals_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."financial_journals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_member_account_unique" ON "financial_accounts" USING btree ("owner_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_backing_account_unique" ON "financial_accounts" USING btree ("kind") WHERE "financial_accounts"."owner_id" is null;--> statement-breakpoint
CREATE INDEX "financial_journal_debit_idx" ON "financial_journals" USING btree ("debit_account_id","created_at");--> statement-breakpoint
CREATE INDEX "financial_journal_credit_idx" ON "financial_journals" USING btree ("credit_account_id","created_at");
--> statement-breakpoint
CREATE FUNCTION financial_reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Financial history and account identities are immutable';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_journals_immutable BEFORE UPDATE OR DELETE ON financial_journals
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_journals_no_truncate BEFORE TRUNCATE ON financial_journals
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_accounts_immutable BEFORE UPDATE OR DELETE ON financial_accounts
FOR EACH ROW EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE TRIGGER financial_accounts_no_truncate BEFORE TRUNCATE ON financial_accounts
FOR EACH STATEMENT EXECUTE FUNCTION financial_reject_mutation();
--> statement-breakpoint
CREATE FUNCTION financial_validate_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  account_record record;
  projected numeric;
BEGIN
  IF NEW.amount_atoms <= 0 OR NEW.debit_account_id = NEW.credit_account_id THEN
    RAISE EXCEPTION 'Invalid financial transfer';
  END IF;
  -- READ COMMITTED operations serialize on the same deterministic account locks.
  -- Higher isolation levels may reject serialization and require whole-command retry.
  FOR account_record IN
    SELECT id, owner_id FROM financial_accounts
    WHERE id IN (NEW.debit_account_id, NEW.credit_account_id) ORDER BY id FOR UPDATE
  LOOP
    IF account_record.owner_id IS NOT NULL THEN
      SELECT coalesce(sum(CASE WHEN credit_account_id = account_record.id THEN amount_atoms ELSE -amount_atoms END), 0)
      INTO projected FROM financial_journals
      WHERE debit_account_id = account_record.id OR credit_account_id = account_record.id;
      projected := projected + CASE WHEN NEW.credit_account_id = account_record.id THEN NEW.amount_atoms ELSE -NEW.amount_atoms END;
      IF projected < 0 THEN RAISE EXCEPTION 'Insufficient available funds'; END IF;
      IF projected > 9223372036854775807 THEN RAISE EXCEPTION 'Account balance exceeds capacity'; END IF;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER financial_transfer_valid BEFORE INSERT ON financial_journals
FOR EACH ROW EXECUTE FUNCTION financial_validate_transfer();
