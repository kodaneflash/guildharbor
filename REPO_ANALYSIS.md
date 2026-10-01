# Repository implementation inventory

Inventory updated: **October 1, 2026** (financial completion; earlier community inventory retained). This replaces the obsolete fixture-prototype assessment. It describes the local working tree, not a deployed or production-accepted release.

## Implemented application

- Authenticated marketplace/community using Next.js 16.2.12, React 19, Better Auth, Drizzle/Neon and Bun. Verified email, valid username and active account are required; private registration mode additionally requires approval. Default registration mode is public, not guest content access.
- Persistent forums, replies, editing/history, search, subscriptions, reputation/vouches and moderation.
- Seller enrollment/storefronts, listing revisions/media/categories, favorites and persistent cart. Paid checkout is connected but gated off pending acceptance.
- Participant-authorized messaging, member controls, notifications/preferences, email outbox and private upload/scanning pipeline.
- Support, staff authorization and audit workflows.
- Unfunded agreements: draft, invitation, acceptance/decline and cancellation. Accepted agreements stop at awaiting funding.
- Current home: search/product-kind rail, listing rows, seller entry point and authorized Top subforums. Navigation includes Marketplace, Forum and Escrow. The former member/seller directory, rules and escrow walkthrough pages are absent; profile/storefront detail routes remain.

## Financial code: present but disabled

The financial gate is hard-coded closed; credentials cannot enable money movement.

Exact micro-USDT paired journals, balance projections, immutable command/evidence history, server-only NOWPayments Direct Payment creation, deposit instructions/QR, local polling, signed callbacks, authoritative lookup and conditional net-credit code exist. Maintenance drains retained IPNs, recovers unidentified commands and polls known deposits; operator commands list exceptions and perform authoritative identity recovery without another provider POST. A two-asset approval manifest separates pay-in network precision from final net USDT settlement.

Exact five-minute USDT quotes/consent, multi-seller atomic checkout/cart changes and safe retries connect standard purchases to protected order delivery. Seller-owned manual fulfillment and maintenance-driven 24-hour pending-to-available settlement are connected. Owner-only purchased-revision delivery and all financial execution remain gated. External cash-out is unavailable; existing fee/limit primitives are not a payout workflow.

## Missing or unaccepted

- Required merchant acceptance: USDT/Ethereum (ERC-20) final net settlement, one additional verified conversion pair, account fees/minimums, actual available backing and real signed callbacks. Latest read-only fixed-rate endpoint returns an empty currency list and custody balance returns 403. Read-only native metadata/merchant selection and pair minimums were confirmed, not settlement capability.
- Exceptional credits/corrections remain a documented independently reviewed manual operator process; no force-credit/unfreeze console is added.
- Funded optional escrow, dual completion, dispute decisions, invitation expiry and closed-chat enforcement.
- Withdrawal destination/security checks, approvals, reservation, provider payout/verification/recovery and automatic 1% fee collection.
- Verified purchase reviews and financial operational acceptance. Refund execution remains explicitly deferred.
- Current authenticated browser/accessibility and live storage/scanner/email/rate-limit/scheduler acceptance are not established by this audit.

See [financial architecture](docs/financial-architecture.md) for exact implementation boundaries and [operations](docs/financial-operations.md) for recovery and activation prerequisites. Do not infer a working feature from its schema or helper alone.

## Verification and preservation

Authorized local lint/type-check/full tests/build and isolated PostgreSQL/service checks ran during core completion. Read-only merchant metadata was inspected; no live payment, migration, settings change or activation occurred. [VERIFICATION.md](VERIFICATION.md) records exact outcomes and remaining acceptance. Ask before new tests, lint, type-check or build.

Preserve the extensive uncommitted implementation. The existing edit to migration 0002 must be reconciled against applied hashes before upgrades; the full chain through 0018 passed isolated fresh-database checks; restored production data still requires rehearsal. Follow [MIGRATIONS.md](MIGRATIONS.md). The [roadmap](roadmap.md) distinguishes requirements, implemented source and remaining work.

October 1 USDT/Ethereum update: the single-currency ledger and provider outcome now use `usdterc20`/`eth`/six-decimal USDT. The configured empty financial subsystem was upgraded through `0018` following a full backup and isolated restore rehearsal, preserving every existing public record. Historical SQL is unchanged. The latest fixed-rate response is 200 with no currencies, balance access is 403, and no pay-in is approved or activated.

Latest October 1 provider follow-up supersedes earlier 403/unknown-primary status: user IP whitelisting restored `/balance` HTTP 200, reporting 2.477743 USDT/ERC-20 available and zero pending at the check. The authenticated dashboard explicitly showed USDT on ETH as Primary. Fixed-rate currency availability remains empty; real payment/conversion/net-fee/IPN and configuration/operational acceptance remain outstanding. Both financial gates remain disabled. See FINANCIAL_HANDOFF.md and current VERIFICATION.md.
