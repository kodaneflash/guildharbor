-- The ledger changes denomination only while financial tables are empty.
-- Existing balances, payment commands, evidence and orders must never be relabeled.
DO $$
DECLARE
  financial_table text;
  records_present boolean;
BEGIN
  FOR financial_table IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND left(tablename, 10) = 'financial_'
    ORDER BY tablename
  LOOP
    EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', financial_table);
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', financial_table) INTO records_present;
    IF records_present THEN
      RAISE EXCEPTION 'USDT currency switch requires empty financial tables; existing financial records must not be relabeled';
    END IF;
  END LOOP;
END;
$$;
--> statement-breakpoint
ALTER TABLE "financial_accounts" DROP CONSTRAINT "financial_account_currency";--> statement-breakpoint
ALTER TABLE "financial_accounts" ALTER COLUMN "currency" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "financial_deposit_requests" ALTER COLUMN "asset" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "financial_deposit_requests" ALTER COLUMN "network" SET DEFAULT 'eth';--> statement-breakpoint
ALTER TABLE "financial_deposits" ALTER COLUMN "asset" SET DEFAULT 'USDT';--> statement-breakpoint
ALTER TABLE "financial_deposits" ALTER COLUMN "network" SET DEFAULT 'eth';--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_account_currency" CHECK ("financial_accounts"."currency" = 'USDT');
--> statement-breakpoint
-- Requests always supply the selected pay-in contract, including NULL for BTC.
ALTER TABLE financial_deposit_requests ALTER COLUMN token_contract DROP DEFAULT;
