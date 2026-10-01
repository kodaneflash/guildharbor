# Verification

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


## Current USDT/Ethereum switch — October 1, 2026

The user authorized focused tests/checks and a database reset if necessary. Source now uses Ethereum ERC-20 USDT (`usdterc20`, network `eth`, chain ID 1, official contract, six decimals) throughout deposits, reconciliation, wallet balances, checkout and seller proceeds. Historical SQL is preserved; `0018` refuses a populated financial subsystem. Nonsecret local settlement configuration was updated; no provider settings, payments or financial activation were performed.

Verified this USDT revision:

- Initial focused financial/UI suite: **97 passed, 4 opt-in PostgreSQL cases skipped**. The updated marketplace integration file then passed **24 cases**, including four added cases for USDC settlement, USDT on another network, invalid Ethereum recovery addresses and historical USDC quotes. This brings the distinct focused passing cases to **101**; the full unrelated suite was not rerun.
- Opt-in disposable PostgreSQL 18: **4 concurrency cases passed**, including competing purchases and concurrent retries.
- Production HTTPS authorization E2E: **4 passed** on desktop Chromium/mobile WebKit, with live database/provider/Redis configuration cleared.
- Lint, TypeScript and production build: passed. The final lint/type-check rerun includes the added regression cases.
- All **18 historical SQL files (`0000`–`0017`) retained their pre-switch SHA-256 hashes**. `0018` metadata was generated offline without connecting to a database.
- The configured Neon database had no financial rows and all 17 applied hashes matched source. A full private SQL backup and record snapshot were retained outside the repository. An isolated Docker PostgreSQL restore matched every public-table record; `0017` and `0018` were rehearsed without changing existing records. The first restore attempt exited during container startup; TCP readiness fixed that and the successful retry completed before any live migration.
- The existing guarded runner applied `0017` and `0018` to the configured database under the user's database-change authorization. Post-migration comparison confirmed all existing public records were preserved; live ledger defaults/constraint are USDT, deposit defaults use `eth`, and the stale contract default is removed. No reset was needed. Financial tables remain empty.

No real provider transaction, provider-settings mutation or financial activation was performed. Browser checks prove authorization boundaries, not merchant settlement acceptance. Full backup and restore receipt: restricted directory `/Users/apex/.codex/backups/guildharbor/usdt-ethereum-1790841230861`. Earlier full-suite results below are historical.

Read-only merchant metadata confirms `USDTERC20`/`usdterc20`, network `eth`, contract/precision/no memo, merchant selection and BTC selection. Pair minimum reads succeeded. After the user whitelisted the requesting IP, custody `/balance` returned HTTP 200 with 2.477743 available USDT/ERC-20 and zero pending (point-in-time snapshot). The authenticated dashboard explicitly marked USDT on ETH as Primary. The database currency defaults/constraint and all migration hashes were rechecked successfully. Fixed-rate availability still returned HTTP 200 with an empty currency list. Neither pay-in is approved for exposure: conversion routing for the second asset, applicable fees, attributable final-net payment evidence, real signed IPNs and missing secret/callback/encryption configuration still require acceptance. Both source gates remain false. The custody balance is merchant funds, not evidence of customer deposit attribution or internal credit.

## Historical marketplace completion — October 1, 2026, before USDT switch

Continuation authorized local tests/lint/type-check/build. Financial execution and servicing remain hard-disabled. This pass connected the core marketplace using the existing dependencies, services, immutable ledger, maintenance route and operator CLI. No credentials were exposed or modified; no live database migration, provider payment, account-settings mutation or financial activation occurred. The extensive pre-existing working tree was preserved.

Executed local checks:

- `bun run lint`: passed with zero warnings.
- `bun run typecheck`: passed.
- `bun run test`: **222 passed, 7 skipped; 34 passing files and 2 skipped files**. The four opt-in real-PostgreSQL checks are among the default skips and were run separately below.
- `FINANCE_POSTGRES_TESTS=1 bun run test src/domains/finance/postgres.integration.test.ts`: **4 passed** on disposable PostgreSQL 18 after starting the existing local container runtime. This uses no live `DATABASE_URL`, host mounts or published ports. An initial repeat attempt could not reach the stopped Docker daemon; the subsequent run passed and removed its own container.
- `DATABASE_URL= DATABASE_URL_UNPOOLED= bun run build`: passed on Next.js 16.2.12; the new checkout/payment/fulfillment/order routes appear in the dynamic route manifest.
- Offline schema generation against an isolated copy of existing migration metadata: **no schema changes / no duplicate migration generated**. Earlier attempts with absolute output paths hit a Drizzle-kit path handling error; the relative-path run completed cleanly without querying a database.
- `git diff --check`: passed.
- Focused production HTTPS Playwright `e2e/financial-boundaries.spec.ts`: **4 passed**, desktop Chromium/mobile WebKit. Live database URLs and Redis were cleared; the existing production HTTPS helper was reused without rebuilding or changing its source. Guest/forged sessions redirect to sign-in, omit financial controls and cannot access protected delivery; unauthenticated mutations return 401, the closed IPN gate returns 503 and unauthorized maintenance returns 401. The browser assertion follows Next's supported streamed redirect behavior. Earlier runtime checks exposed a page-loader `FORBIDDEN` race; existing `communityNotice` guards now precede financial page reads.


The financial PGlite integration suite applies the entire migration chain through `0017` and runs actual domain services with isolated provider responses. It covers BTC pay-in precision versus final net USDC, the connected deposit-to-purchase-to-protected-fulfillment journey, duplicate signed IPNs/confirmations, retained callback draining after lookup failure, missed callbacks, uncertain creation with no second POST, sticky partial/repeated/wrong-asset/overpaid/invalid-net/unbacked evidence, conflicting credited evidence and financial freezes, multi-seller atomic journals/orders/cart removal, changed-listing rollback, exact consent/insufficient balance/backing failures, protected manual/exact-file authorization and seller hold release exactly once. Existing classifier tests cover late payments and signature/precision failures. React tests verify selected asset/amount/request identity after interrupted creation and explicit exact-charge consent with interrupted purchase retries.

Independent real PostgreSQL sessions race competing spends and duplicate references, plus competing 60-USDC purchases against a 100-USDC wallet and concurrent retries of the same order. These exercise actual row locks and database journal/order constraints. The complete TypeScript checkout orchestration is exercised in PGlite; these SQL races are not a live-provider concurrency exercise.

Read-only merchant metadata confirmed native `USDCBASE` (`usdcbase`), Base network, six decimals, native contract, no memo and merchant selection; BTC was also selected. Pair minimum reads succeeded. The latest fixed-rate availability request returned **404** and custody `/balance` returned **403**. Conversion settings, account-specific fees, actual final net USDC/Base settlement and usable backing access remain unverified. No asset was approved/exposed for funding. Public docs and metadata are not merchant settlement acceptance.

Remaining required acceptance: real signed/provider settlement fixtures for the two-asset allowlist, resolved fixed-rate/custody responses, missing secret/evidence/delivery configuration, restored-data migration/hash preservation rehearsal, deployed scheduler/alerts/operator ownership and the authenticated buyer/seller journey in an explicitly authorized acceptance environment. No live merchant transaction or authenticated production financial journey was performed. External cash-out and excluded enhancements remain unavailable. See [architecture](docs/financial-architecture.md) and [operations](docs/financial-operations.md).

## Historical evidence — September 12, 2026

These results describe that earlier revision, not current routes or release acceptance.

### Passed

- `bun run lint`: no warnings or errors.
- `bun run typecheck`: passed.
- `bun run build`: passed; every application page is rendered dynamically. No marketplace/demo-avatar routes remain in the route manifest.
- `bun run test`: **45 tests across 10 files passed**.
- Production browser suite over local HTTPS: **12 tests passed**, covering desktop Chromium and mobile WebKit.
- `git diff --check`: passed.

The 15 PostgreSQL/Better Auth integration cases run the repository migrations and actual application auth, query, action and service code against disposable PGlite PostgreSQL with `citext` and `pg_trgm`. They cover:

- Existing member-authored posts surviving the marketplace schema migration; old selling threads become discussions; existing accounts default to pending.
- Atomic profile/member-role provisioning and verified-but-pending accounts remaining denied.
- Guest and pending denials at query, feed, file, upload, thread-view and administrator-action boundaries.
- Approved-only member directory output and rejection of client-supplied approval/account-status values.
- Administrator approval with an audit record, ordinary-member staff denial, rejection, and immediate denial of a previously approved session after approval is removed.
- Persistent first posts and replies, reply counters and post-text search; private-subforum exclusions from listing/search/thread/feed access.
- Reserved/missing username rejection, availability checks, normalization, a competing database insert, and social-onboarding state transitions.
- Better Auth password changes, rejection of the old password, TOTP enrollment confirmation and the subsequent password-login challenge. Email OTP login cannot bypass the enabled password/TOTP flow.
- Avatar ownership, image/checksum validation, actual Sharp WebP processing, atomic attachment/profile updates, private file serving, guest denial, and rejection of invalid bytes without replacing the prior avatar.

Other automated cases cover the full account-state policy, username debounce, Turnstile server validation failures and hostname/action checks, existing rich-text sanitization, cursors and component rendering.

Browser cases verify the exact guest copy; links to registration/login; guest gates across community and staff pages; no private title/profile data in metadata; no demo content in HTML/RSC; no-store responses; denied APIs/feeds/files; removed routes; correct Members navigation; and no horizontal overflow at 320px.

## What these tests do not establish

At that historical verification run, no Neon, Resend, R2, Cloudflare or OAuth credentials were present. Credential availability was not inspected in this audit. No migration or bootstrap was run against a cloud database. No production domain, dashboard or DNS settings were changed.

- Neon network/pooling and the deployed migration must be checked against your configured database.
- Email delivery is captured inside the integration tests. Verify real verification/reset email delivery after configuring Resend.
- Social onboarding tests exercise actual Better Auth user-update hooks, but do not contact Google or Apple. Verify their complete redirect/callback flow with provider credentials.
- R2 object operations and URL signing are mocked in integration tests; actual bytes are validated and processed by the application. Verify signed PUT, CORS, scoped credentials, persistence after refresh, and denied guest retrieval against the private bucket.
- Turnstile responses are mocked. Verify a real widget and Siteverify with the configured hostname/action and the actual Cloudflare managed-challenge rule. Confirm previously public caches/storage endpoints are disabled or purged.
- Authenticated flows are integration-tested at the auth/service/database boundaries, not in a browser connected to Neon. Run the acceptance checklist below after configuration.

## Credentialed acceptance checklist

1. Apply migrations and bootstrap the verified administrator as documented in `README.md`.
2. In private registration mode, register a second account. Confirm pending copy before and after email verification and login. Attempt known thread/member/feed/file URLs; no content should be returned.
3. Approve that account in the queue. Confirm profile/forum access, create a thread, follow the redirect, refresh, and post a reply. Confirm both persisted contents remain. Reject another application and confirm it cannot read the same resources.
4. Register via an enabled social provider. Confirm username onboarding is required, and pending review is additionally required in private mode. Try an unavailable/reserved username and competing registrations; only one account may own a normalized username.
5. Change the approved member's password. Confirm the old password fails. Enroll an authenticator, confirm its code, log out, and verify that the next password login requires TOTP.
6. Upload an avatar and refresh the profile/header/thread. Verify the bucket is private and the same application file URL fails for guest and rejected sessions, and pending sessions in private mode.
7. Confirm Cloudflare verification works on the deployed origin, and that HTML/RSC, APIs, feeds and private files bypass shared caching.

Local browser note: the first mobile run against plain HTTP could not load assets because the production CSP upgrades requests to HTTPS. All 12 cases passed after testing through a temporary local HTTPS proxy, without weakening CSP. `PLAYWRIGHT_LOCAL_HTTPS=1` only allows a self-signed certificate in the test browser; it is not an application setting.

## Community access modes

Historical access-mode verification (not a rerun against the current implementation):
- Lint and TypeScript: pass.
- Vitest: 70 tests across 10 files pass, using migrated PGlite and real Better Auth for integration coverage.
- Production build: pass; community pages remain dynamically rendered.
- Production Playwright over local HTTPS: 12 tests pass in public mode and 12 in private mode (desktop Chromium and mobile WebKit).
- Coverage includes guest pages, HTML/RSC, metadata, APIs, queries, Server Actions, feeds and files; pending public membership and reversal to private; explicit approval retention; account restrictions; social username eligibility; username uniqueness; thread/reply persistence; private avatars in both modes; password changes, TOTP and Turnstile.
- Storage and outbound email/OAuth provider services are isolated in integration tests; this does not represent a live external-provider deployment test.

No new mode migration is needed: public eligibility never writes approval. Existing approved rows retain explicit approval and pending rows require review again after switching back to private. Set COMMUNITY_ACCESS_MODE=public or COMMUNITY_ACCESS_MODE=private in Vercel and redeploy; the current code defaults to public when omitted. This default is a current source finding, not evidence of a deployed configuration.

## Browser scope note — October 1

Rapid sequential full-page navigation in WebKit produced auth-page RSC prefetch access-control errors while pages still reached sign-in. This was observed on the existing sign-in implementation, not a financial/provider mutation. The focused financial E2E asserts authorization and absence of financial content/actions; it does not certify a globally error-free auth frontend. Auth-prefetch investigation is separate future work. No new auth redesign or browser-error suppression was implemented. Authenticated financial browser and accessibility acceptance still require the approved migrated acceptance environment.
