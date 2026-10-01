ALTER TABLE "financial_accounts" DROP CONSTRAINT "financial_account_owner";--> statement-breakpoint
ALTER TABLE "financial_journals" DROP CONSTRAINT "financial_journal_kind";--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_account_owner" CHECK (("financial_accounts"."owner_id" is not null and "financial_accounts"."kind" in ('available','pending','reserved')) or ("financial_accounts"."owner_id" is null and "financial_accounts"."kind" in ('backing','platform_revenue')));--> statement-breakpoint
ALTER TABLE "financial_journals" ADD CONSTRAINT "financial_journal_kind" CHECK ("financial_journals"."kind" in ('deposit','purchase','reservation','escrow','settlement','refund','adjustment','withdrawal','withdrawal_fee'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION financial_validate_transfer() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  account_record record;
  projected numeric;
BEGIN
  IF NEW.amount_atoms <= 0 OR NEW.debit_account_id = NEW.credit_account_id THEN
    RAISE EXCEPTION 'Invalid financial transfer';
  END IF;
  IF NEW.kind = 'withdrawal_fee' AND NOT EXISTS (
    SELECT 1 FROM financial_accounts debit, financial_accounts credit
    WHERE debit.id = NEW.debit_account_id AND debit.kind = 'reserved'
      AND debit.owner_id IS NOT NULL AND credit.id = NEW.credit_account_id
      AND credit.kind = 'platform_revenue' AND credit.owner_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Withdrawal fee must transfer reserved funds to platform revenue';
  END IF;
  FOR account_record IN
    SELECT id, kind FROM financial_accounts
    WHERE id IN (NEW.debit_account_id, NEW.credit_account_id) ORDER BY id FOR UPDATE
  LOOP
    IF account_record.kind <> 'backing' THEN
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
