# Financial acceptance handoff — October 1, 2026

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


Continue the core marketplace in `/Users/apex/Desktop/guildharbor`. Complete configuration and merchant-backed acceptance of the existing flow; make surgical fixes only when evidence reveals a correctness, security or reliability failure. Explain the necessity before expanding scope. Do not rebuild it or add frameworks, queues, dashboards or unrelated features.

Read applicable AGENTS.md, git status, package.json, roadmap.md, docs/financial-architecture.md, docs/financial-operations.md, MIGRATIONS.md, the current section of VERIFICATION.md and relevant actual code. Preserve the extensive existing working tree. Treat older USDC/Base policy and provider-403 notes as superseded by the verified state below.

## Verified starting point

- Single-currency internal ledger: USDT on Ethereum ERC-20, provider ticker `usdterc20`, network `eth`, chain ID 1, six decimals, contract `0xdAC17F958D2ee523a2206206994597C13D831ec7`. USD is a reference price, not a 1:1 conversion promise. Exact helpers are `parseUsdt`, `formatUsdt`, `positiveUsdt` and `USDT_SCALE`; pay-in precision remains separate.
- The authenticated NOWPayments custody dashboard explicitly marks USDT on ETH as Primary. The user whitelisted the local requesting IP; `/balance` now returns HTTP 200. At the check it reported 2.477743 available USDT/ERC-20 and zero pending. This is merchant custody money, not a credited customer deposit. Provider metadata confirms the token/network/contract/precision and merchant selection of USDT/ERC-20 and BTC. It does not approve BTC conversion.
- The configured Neon database is migrated through `0018_usdt_ethereum`. All applied hashes match, historical SQL is preserved, existing public records survived full backup/isolated-restore rehearsal and guarded migration. Financial tables were empty; no reset was needed. `0018` rejects nonempty financial tables rather than relabeling assets. Do not rerun/reset an already migrated database or alter history.
- Local verification passed: 101 distinct focused financial/UI cases, four disposable PostgreSQL concurrency cases, four production HTTPS authorization cases, lint, type-check and build. Provider responses were isolated in service tests; these results do not prove live merchant payment acceptance. See VERIFICATION.md for precise scope and historical results.

## Connected implementation

1. `deposit-creation.ts`, `deposit-provider.ts`, `assets.ts`, `commands.ts`: server-only Direct Payments; USD reference input and a two-asset approved manifest; exact amount, provider address, local QR, memo/minimum/expiry and honest estimates. Durable command claim precedes one POST; uncertain creation never blindly POSTs again.
2. `nowpayments.ts`, `deposit-observation.ts`, `deposit-recovery.ts`: signed durable/deduplicated IPNs trigger authoritative lookup; final actual net USDT is credited once only when available USDT backing covers liabilities. Immutable balanced journals/evidence and sticky review protect ambiguous payments. Existing maintenance recovers missed callbacks, retained receipts and uncertain requests; the role-checked operator CLI identifies original payments.
3. `wallet-view.ts`, `purchase-estimate.ts`, `checkout.ts`, `purchase-flow.ts`: committed available/pending/reserved USDT balances; USD-to-USDT rate evidence; exact five-minute charge consent; old currency-policy quotes rejected; canonical locks and one transaction commit journals, orders and purchased cart changes. Retries do not charge twice.
4. `orders.ts`, `seller-orders.ts`, protected order/file routes: buyer entitlement comes from the committed purchase and purchased revision. Protected text, exact files and seller-owned encrypted manual fulfillment use existing order pages/messaging. Existing authenticated maintenance releases eligible seller pending proceeds after the enforced 24-hour hold, exactly once, into internal available USDT.

## Disabled and remaining work

`src/domains/finance/gate.ts` has BOTH `financialExecutionEnabled=false` and `financialServicingEnabled=false`. New deposits/purchases, deposit processing/recovery, financial wallet/order access, protected paid delivery, seller fulfillment and hold settlement are therefore unavailable in the running app. Tests enable services through isolated mocks; environment credentials cannot open production gates. The maintenance endpoint is wired but its financial jobs currently report disabled.

The latest fixed-rate currencies endpoint returns HTTP 200 with an empty list. Current preflight requires verified fixed-rate availability; diagnose the actual account/API response with current official documentation/provider evidence. Do not fabricate availability or silently weaken checks. Local IPN secret, callback URL, financial evidence encryption key, delivery encryption key and approved-asset manifest were absent at the latest inspection. Provision securely, retaining existing keys where present; never print credentials. Verify the deployed backend's outgoing IP separately from the local whitelist.

## Next acceptance work

Start preparation now; keep production gates closed. Reuse the existing test suites and maintenance/operator mechanisms. Follow the user's permission requirement before tests/lint/type-check/build; local checks were previously authorized in this conversation, but determine whether that authorization carries into your task. This handoff is not permission for live payments or activation.

1. Resolve fixed-rate capability and supply missing server configuration. Verify custody conversion into USDT/ERC-20 for exactly one additional asset/network. Existing non-primary asset balances can change routing, so Primary alone is insufficient. Confirm fees, minimums and final-net semantics before approving/exposing assets.
2. Prepare an isolated acceptance environment and actual authenticated buyer/seller browser journey. Verify callback HTTPS reachability/signatures, scheduler authentication/runtime and named operator ownership. Do not deploy, change provider settings, create payments or enable financial gates without explicit human authorization. For a real test, obtain an agreed payment asset, amount limit and environment first.
3. After authorization, capture authoritative payment-level final net USDT and custody backing evidence; test deposit → wallet → exact purchase → protected fulfillment → seller proceeds. Never credit solely from a screenshot or aggregate custody balance. Verify duplicate confirmations, missed callbacks, uncertain creation, invalid/unbacked settlement, concurrent spending, purchase retries, premature/duplicate seller release and unauthorized delivery using focused existing fixtures plus appropriate provider acceptance. Preserve the real 24-hour production hold.
4. Report actual results and specific remaining gates. Obtain separate explicit production activation approval. After activation, pausing new execution must preserve servicing of existing obligations.

External cash-out/withdrawals, funded escrow, refunds, affiliates, additional providers, multi-currency accounting, analytics, history pagination and a financial administration console remain excluded. Seller internal settlement does not provide external cash-out.

Official sources: [NOWPayments API](https://documenter.getpostman.com/view/7907941/2s93JusNJt), [custody primary/routing guide](https://nowpayments.io/blog/getting-started-with-custody-balances-on-nowpayments), [supported coins](https://nowpayments.io/supported-coins), [pricing](https://nowpayments.io/pricing), [custody overview](https://nowpayments.io/blog/overview-crypto-custody).
