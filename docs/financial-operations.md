# Core marketplace financial operations

## Current payment setup — October 1, 2026

Owner-authorized activation enables both source gates. Deposits now request ordinary rates (`is_fixed_rate=false`, `is_fee_paid_by_user=false`); capability checks use the ordinary currency list and ordinary-rate pair minimum, not the empty fixed-rate list. Exact provider payment instructions, expiry, pay-in identity, actual final net USDT, duplicate protection and available custody backing checks remain enforced. Final credited USDT may differ from estimates.

The allowlist supports one or two assets. Only USDT/Ethereum is configured initially: merchant primary, availability, contract, precision and ordinary minimum were verified read-only. BTC is hidden until conversion acceptance. This intentionally removes the unnecessary dependency on approving a second asset before USDT deposits can be used; it does not expand the supported currencies.

The linked Vercel Production project `guildharbor`, serving `outlawsite.vercel.app`, now has API/IPN/callback/settlement/allowlist/evidence/delivery configuration installed securely from the ignored local environment. Deployment of this code is still required for the running website to use the changes. The provider IPN secret must match the installed value; no secret values belong in Git.

NOWPayments may auto-process supported wrong-asset payments at its end. The app retains authoritative evidence, recognizes `wrong_asset_confirmed`, rejects changed pay-in/outcome identities and related child transfers for automatic credit, and keeps them under review under the original acceptance requirement. A provider `finished` flag alone never establishes safe customer credit. Provider settings are configured separately in the dashboard; this code change does not modify those settings.

These facts supersede earlier fixed-rate, missing-configuration and mandatory-two-asset statements below. No live customer payment or BTC conversion has been verified.


## Activation update — October 1, 2026

The owner explicitly authorized financial activation. Both source gates are now enabled: wallet reads, orders, protected delivery, callbacks, recovery and seller hold processing can run; deposits and checkout still enforce existing configuration, approved assets, final settlement and backing checks. This supersedes earlier statements that both gates are disabled.

The ignored local environment now contains the supplied IPN secret, callback `https://outlawsite.vercel.app/api/payments/nowpayments/ipn`, newly generated missing evidence/delivery keys and evidence key version. Existing keys were not replaced. These secrets must also be securely provisioned in the deployed environment; Git does not deploy `.env.local`. No live payment or deployment was performed.

Read-only recheck: custody balance access returns HTTP 200 with a USDT/ERC-20 bucket, but the fixed-rate currencies endpoint still returns an empty list. The approved asset manifest remains absent. Consequently no deposit address can currently be issued; do not bypass capability/finality/backing checks or claim a verified live payment flow. Provisioning alone does not prove the provider has the same IPN secret; confirm the merchant setting.


Updated **October 1, 2026**. Local implementation and isolated checks are recorded in [verification](../VERIFICATION.md); provider acceptance and production activation remain blocked. This runbook supersedes the former deposit-only audit.

## Before activation

Both source gates in `src/domains/finance/gate.ts` remain false. Do not activate from an environment variable or treat an API key as approval. Obtain explicit authorization before live migrations, payments, settings changes or activation. Future pause of new deposits/purchases must retain existing-obligation servicing. External withdrawals, refunds and funded escrow are unavailable in this scope.

Required gates:

1. Confirm USDT/Ethereum ERC-20 custody primary and BTC/network conversion into `usdterc20`, including conversion settings, fixed-rate availability, account fees/minimums and final `outcome_amount` semantics. Read-only metadata confirms provider identifier `USDTERC20` / `usdterc20`, network `eth`, six decimals, contract `0xdAC17F958D2ee523a2206206994597C13D831ec7`, no memo, merchant selection and BTC selection. This is not conversion approval. The latest fixed-rate response was HTTP 200 with an empty list; deposits remain blocked. The [custody guide](https://nowpayments.io/blog/getting-started-with-custody-balances-on-nowpayments) says existing asset balances can bypass primary conversion. Verify routing rather than creating another asset balance to work around the configuration.
2. Custody `/balance` access now works after the requesting IP was whitelisted; dashboard USDT on ETH Primary was confirmed. Verify the deployed backend outgoing IP is also authorized. Verify available `amount`, excluding `pendingAmount`, is usable final USDT/Ethereum backing and `finished` evidence represents attributable actual net settlement into it. Retain approved final settlement evidence for both pay-ins and the backing change. Restrict provider dashboard/API debits so they cannot bypass treasury controls.
3. Supply server-only API/IPN/callback/ticker/evidence configuration from `.env.example`, protected delivery encryption and an evidence-approved two-entry asset manifest. The nonsecret local settlement ticker is now `usdterc20`; IPN/evidence/delivery configuration and asset approvals still require secure provisioning and acceptance. Retain encryption keys securely; overwriting the only historical key loses access. Current evidence decryption requires the retained key version; rotating the write key requires a separately reviewed keyring/retention procedure before use.
4. Obtain real provider-signed IPN fixtures, including documented canonicalization/numeric/array edge cases. Demonstrate callback HTTPS reachability, missed-callback recovery, crash-after-claim recovery and the final-net/backing contract in an explicitly authorized acceptance environment. Synthetic signatures and mocked provider tests do not satisfy this gate.
5. Follow [MIGRATIONS.md](../MIGRATIONS.md): compare actual applied hashes, preserve the pre-existing `0002` discrepancy, back up records/private storage, rehearse on a restored copy, then separately authorize the guarded live migration. Isolated fresh-database success through `0018` is not restored-production-data acceptance.
6. Assign named reconciliation, treasury and incident operators; verify their scoped roles and evidence access. Configure the existing scheduler, runtime, alerts and review ownership described below. Run authenticated buyer/seller production acceptance against the migrated acceptance database before requesting explicit activation.

`NOWPAYMENTS_APPROVED_ASSETS` is JSON containing exactly two entries, USDT/Ethereum (ERC-20) first and one verified additional cryptocurrency/network second. Each entry supplies `ticker`, `asset`, `network`, `decimals`, `tokenContract` (null for a native coin), `memoRequired`, and `verificationReference` naming restricted merchant acceptance evidence. The first ticker must equal `NOWPAYMENTS_SETTLEMENT_TICKER`. No sample approval is installed. The first network must be `eth`, precision 6, with the official Ethereum USDT contract; a USDT ticker on another chain is rejected. The browser receives only ticker, asset and network. To approve BTC, verify actual BTC-to-USDT/Ethereum conversion settlement first; being listed by the API is insufficient.

## Existing maintenance and reconciliation

Schedule authenticated `POST /api/internal/maintenance` at least once per minute with `Authorization: Bearer <MAINTENANCE_SECRET>`. The route also runs existing notification maintenance. Financial processing is gated off until acceptance. Each invocation attempts one due retained receipt, one unidentified command, three known deposit observations and up to 25 mature seller orders. Claims persist retry times; crashes become eligible again. Normal deposit observations defer one minute, failed claims five minutes, review/expired observations one hour and credited observations one day. Unidentified commands retry after five minutes. These intervals are not finality or customer timing promises.

The route declares a 300-second maximum duration. Verify the actual host supports that runtime and database transactions across bounded provider calls. Alert on HTTP 503, `finance.deposit.lookup_failed`, `finance.deposit.identification_required`, `finance.seller_hold.failed`, stale due items and unmatched/unprocessed receipts. Overlapping runs remain safe through member/account locks, receipt deduplication, due claims and stable journal references. Verify scheduler capacity with expected volume; no new queue is installed.

Run commands only after explicitly selecting the intended migrated database:

- `bun run finance:reconcile`: read-only internal balance/journal consistency. It deliberately cannot certify provider backing.
- `bun run finance:reconcile --provider`: read-only point-in-time comparison of provider available USDT with all member liabilities plus platform revenue. Failure exits unsuccessfully; it performs no repair. It does not prove an individual deposit's attribution/finality or guarantee funds remain available afterward.
- `bun run finance:deposits review <operator-user-id>`: bounded list of unresolved/review requests. Requires `finance.reconcile`; generic administrator access is insufficient.
- `bun run finance:deposits recover <operator-user-id> <command-uuid> <provider-payment-id>`: audited authoritative lookup/recovery through the same checks as callbacks. It cannot bypass the servicing gate, substitute provider identity, POST another payment or force a credit.

Payment-list discovery additionally requires `NOWPAYMENTS_READ_JWT`, a short-lived merchant read token. Do not store merchant login credentials in the app or log the token. Refresh it through an approved operator process. If unavailable/expired, use the role-checked recovery CLI after identifying the original payment in the merchant dashboard by its exact order reference. The bounded listing window is submitted time minus one minute to plus five minutes, with one page of at most 500 records. Missing, multiple or truncated matches remain unresolved; do not infer nonpayment or blindly create another payment.

## Manual exception and incident process

1. The designated reconciliation operator records an access-controlled case using the existing support/audit mechanisms: command/order ID, reason, immutable evidence references and customer chain hash. Do not publish addresses, raw evidence or secrets in logs. Partial, overpaid, late, wrong-asset, duplicate-chain-transfer, missing-instruction and ambiguous payments remain uncredited in review.
2. Read the original provider payment and any child transfers. Obtain authoritative final outcome currency, actual net amount, transfer attribution and available custody evidence. Escalate discrepancies to provider support through the operator's existing process. A customer screenshot, callback, minimum estimate or aggregate balance alone does not authorize credit.
3. Recover only the original identity using the CLI. If creation-shaped instructions are missing, recovery retains an identified review record and issues no payable instructions. Review states are sticky: a later `finished` response does not erase a previously ambiguous transfer history.
4. If evidence remains ambiguous or backing fails, keep it pending and explain that status to the customer. Do not ask the customer to send an additional transfer to fix the original payment. Unidentified commands may block new deposits until their original identity is established; this release has no authoritative nonpayment-reset operation.
5. Any exceptional credit/correction or removal of a financial freeze requires a separately authorized, independently reviewed operator repair based on the retained authoritative settlement evidence and backed liabilities. Rehearse it on an isolated copy before executing a reviewed transactional forward correction. Use the domain's normal journal/integrity checks and new immutable references; never edit a journal, disable a trigger, reset an uncertain command or issue a refund/payout through this release. The listing/recovery CLI intentionally has no force-credit/unfreeze command.

A conflicting lookup after credit freezes further member financial activity and delivery; the existing journal remains intact. Pause new execution on a backing incident while servicing/reconciliation continues. Preserve every unresolved external outcome and restrict provider withdrawals. Internal seller hold release changes the liability bucket only; it does not move external funds or permit cash-out.

## Local verification and migration notes

Ask before tests, lint, type-check or build; continuation authorized this task's local checks. Reuse `bun run lint`, `bun run typecheck`, focused/full `bun run test` and `bun run build`. `FINANCE_POSTGRES_TESTS=1 bun run test src/domains/finance/postgres.integration.test.ts` uses only its ephemeral Docker PostgreSQL container, no `DATABASE_URL`, host mounts or published ports. Browser acceptance must isolate live configuration. Never claim a provider-backed customer journey from mocked integration evidence.

Forward migration `0017_marketplace_completion.sql` adds cross-asset identities, recovery receipts, immutable checkout/fulfillment records and purchase/hold integrity. Nullable settlement identity preserves historical same-asset rows without rewriting their immutable data. Retain all financial tables and evidence on rollback; pause the application and use reviewed forward corrections. SQL owns custom triggers/constraints; generated schema metadata is not evidence that those protections ran.

Official references: [API](https://documenter.getpostman.com/view/7907941/2s93JusNJt), [supported assets](https://nowpayments.io/supported-coins), [pricing](https://nowpayments.io/pricing), [custody activation](https://nowpayments.io/blog/overview-crypto-custody). Public pricing and advertised payment times are not account-specific fee/net/finality acceptance.

## USDT/Ethereum switch — October 1, 2026

`NOWPAYMENTS_SETTLEMENT_TICKER=usdterc20` replaces the former USDC/Base-specific setting; there is no legacy fallback. New deposits, backing reads and purchase estimates are restricted to this provider settlement identifier. The merchant dashboard primary setting is independently verified during acceptance; the application cannot set it by changing an environment variable.

Apply forward migration `0018_usdt_ethereum.sql` through the guarded runner after preservation and restore rehearsal. It refuses any nonempty financial table, including uncertain commands or old quotes, and never relabels financial history. User authorization permits resetting this development database if needed; the inspected financial tables were empty, so no reset was needed. The configured database has now received `0017` and `0018` after a full SQL backup and isolated restore/record-preservation rehearsal through the existing guarded runner. Other targets must follow the same preservation procedure. Keep source execution/servicing gates closed and keep the approval manifest empty until real merchant acceptance.
