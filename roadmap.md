# GuildHarbor marketplace blueprint and implementation roadmap

**Current status (2026-09-20):** Sections 1–16 are the product blueprint and include historical baseline observations from commit `085b85c`; do not treat those observations or the original phase descriptions as the current implementation inventory. Section 17 records code added in the working tree through phases 0–5 and parts of phase 6. Section 18 records the signed-in member-home implementation and its acceptance criteria. The working tree contains extensive uncommitted application changes. The configured database already contains the complete migration journal through `0008`; a private full-database backup was restored locally with matching public-table checksums. Deployed storage, scanning, email and rate-limit integrations and the remaining authenticated browser/concurrency acceptance are still open, so Phase 6 is not complete. Read the execution record and inspect current code before deciding what remains.

## 1. Verified baseline and architectural direction

### Current repository

Verified September 20, 2026:

| Area | Current finding |
|---|---|
| Stack | Next.js 16.2.12, React 19.2.4, TypeScript, Tailwind CSS 4, Better Auth, Drizzle, Neon, Tiptap, S3-compatible storage, Upstash, Resend, Vitest, Playwright. Bun is the package manager. |
| Git and planning | Clean `main`; latest commit enables reversible open-registration eligibility. No existing roadmap or partial blueprint found. |
| Forum | Persistent reads, thread creation, and replies exist. Search includes thread titles and post text; queries already support pagination. Complete and verify remaining controls rather than replacing these capabilities. |
| Identity | Canonical Better Auth users, profiles, roles, username provisioning, and centralized membership eligibility exist. |
| Registration | `COMMUNITY_ACCESS_MODE=public` admits verified, active users with valid usernames without administrator approval. It does **not** expose community content to guests. Omission currently defaults to private mode. |
| Messages | Database-backed conversations and authorized reads exist; composition and persistent conversation creation remain missing. |
| Notifications | User-specific reads exist, but delivery, read-state actions, preferences, and complete resource routing remain unfinished. |
| Administration | Registration review performs audited writes. Most other staff screens list records without complete operational workflows. |
| Uploads | Working architecture is avatar-specific. Existing attachment tables do not establish marketplace or message-file delivery. |
| Maintenance | Authenticated endpoint explicitly returns `501`; no jobs are configured. |
| Marketplace | Current schema has no marketplace listings. Migration `0002` removes the historical listing table. |
| Privacy | Dynamic rendering and private/no-store responses are configured. Cache Components is disabled. |
| Historical reports | `REPO_ANALYSIS.md` predates substantial improvements and must not guide implementation without checking current code. |

Evidence:

- [Membership eligibility](/Users/apex/Desktop/guildharbor/src/lib/community-access.ts), [session and permission boundaries](/Users/apex/Desktop/guildharbor/src/lib/session.ts).
- [Persistent forum queries](/Users/apex/Desktop/guildharbor/src/db/queries/community.ts), [thread service](/Users/apex/Desktop/guildharbor/src/domains/thread/thread-service.ts).
- [Message queries](/Users/apex/Desktop/guildharbor/src/db/queries/message-queries.ts), [message workspace](/Users/apex/Desktop/guildharbor/src/components/messages-workspace.tsx).
- [Notifications](/Users/apex/Desktop/guildharbor/src/app/notifications/page.tsx), [staff screens](/Users/apex/Desktop/guildharbor/src/components/staff-page.tsx).
- [Current schema](/Users/apex/Desktop/guildharbor/src/db/schema/index.ts), [migration 0002](/Users/apex/Desktop/guildharbor/drizzle/0002_private_forum.sql).
- [File authorization](/Users/apex/Desktop/guildharbor/src/app/api/files/[id]/route.ts), [profile projection](/Users/apex/Desktop/guildharbor/src/db/resolve-profile.ts).

### Verification

Executed during this recovery:

- `bun run lint`: passed.
- `bun run typecheck`: passed.
- `bun run test`: **70 tests across 10 files passed**.
- `bun run build`: passed; application routes render dynamically.
- `git diff --check`: passed; checkout remains clean.

Historical evidence, **not rerun here**:

- Dependency installation succeeded in the previous session.
- Production HTTPS browser checks passed; `VERIFICATION.md` records 12 cases in each community-access mode.
- Previous development-mode cache-header/mobile failures did not reproduce in production.
- Limited guest/auth accessibility scans previously passed.

Only `.env.example` was found. Relevant database, authentication, storage, and email credentials were absent from the inspected process environment. The previously reported empty Neon database was not reverified. Live database access is unnecessary to finish this blueprint.

### Strategy B

Preserve the existing stack, canonical identities, profiles, forum records, URLs, authentication, and reusable infrastructure.

Selectively modernize:

- Consolidate resource authorization and transactional business operations.
- Move database orchestration out of presentation components as each affected workflow is completed.
- Extend the existing domain-service pattern for commerce, messaging, delivery, deals, and support.
- Keep forum categories and threads separate from marketplace taxonomy and listings.
- Do not introduce another auth system, forum, ORM, payment substitute, or broad framework rewrite.

## 2. Access policy and information architecture

### Confirmed access policy

**The entire application is authentication-gated. There is no guest catalog, storefront, profile, forum, or informational-page browsing.**

Guest document requests redirect to `/sign-in`, which prominently links to `/sign-up`. Preserve an internal return destination, validate it as same-origin, and reauthorize it after authentication.

Necessary exceptions:

- Sign-in, sign-up, password recovery/reset, verification, and two-factor challenge screens.
- Better Auth endpoints, OAuth callbacks, registration verification dependencies, and static assets required by those screens.
- Operational endpoints use their own service authentication.
- Future payment webhooks use provider authentication, never browser-session authentication.

Username onboarding requires an authenticated session but must remain reachable before normal eligibility. Unverified users receive verification guidance; restricted users receive an account-status screen with appropriate recovery/support access.

A signed-in user does not automatically gain access to another user’s orders, conversations, files, seller controls, private subforums, or staff tools.

Use the existing public **registration** mode for this product. Retain reversible private-mode capability, but do not require normal registrants to obtain approval or bulk-write permanent approvals.

Page redirects are a navigation feature. Queries, actions, Route Handlers, metadata, feeds, files, and RSC responses must independently enforce authorization. API denials return appropriate status codes rather than login HTML.

### Routes and navigation

All product routes below require eligible membership; owner, participant, and staff checks apply additionally.

| Area | Routes |
|---|---|
| Member home | `/` |
| Marketplace | `/marketplace`, `/marketplace/categories/[slug]`, `/marketplace/[listingId]/[slug]` |
| Seller discovery | `/sellers`, `/sellers/[username]` |
| Existing community | Preserve `/forums`, `/forums/[forumSlug]`, `/threads/...`, `/members/...`, `/search` |
| Buyer account | `/account`, `/account/favorites`, `/account/orders`, `/account/orders/[orderId]` |
| Communication | Preserve `/messages`, `/messages/[conversationId]`, `/notifications` |
| Settings | Preserve `/settings/profile`, `/settings/security`; add `/settings/notifications` |
| Seller workspace | `/seller/onboarding`, `/seller`, `/seller/storefront`, `/seller/listings`, `/seller/listings/new`, `/seller/listings/[listingId]/edit`, `/seller/orders` |
| Optional deals | `/deals`, `/deals/new`, `/deals/[dealId]`, `/deals/archive`, `/deals/how-it-works` |
| Support | `/support`, `/support/cases/[caseId]` |
| Policies/information | `/help`, `/rules`, `/privacy`, `/terms`; all gated |
| Administration | Preserve current routes; add seller, listing, marketplace-category, support, deal-oversight, and audit screens under `/admin` |
| Paid milestone | `/account/payments`, `/account/refunds`, `/account/wallet`, `/seller/earnings`, `/seller/withdrawals` |
| Later enhancements | Affiliate, advertising, promotion, tier, and advanced analytics workspaces |

Primary navigation: **Marketplace, Forum, Sellers, Deals**. Account navigation contains messages, notifications, favorites, orders, settings, and role-appropriate seller/staff entry points.

Reuse GuildHarbor’s semantic tokens and branding. Use a compact desktop header, accessible mobile navigation, responsive catalog cards, mobile filter sheets, and focused transaction detail pages. Do not reproduce STYX branding, advertising rails, product copy, or unsupported trust claims.

Build essential responsiveness and WCAG 2.2 AA into every phase; later visual refinement is additional polish.

## 3. Reference-to-feature map

The eight attached images were available for inspection. The additional five-stage walkthrough images were not attached here; their workflow is taken from the user’s written handoff.

**MVP** means pre-funding release. **Paid** requires the separately approved financial milestone.

| Reference and evidence | GuildHarbor approach and domain | Phase | Acceptance |
|---|---|---|---|
| Image 1: search, categories, filters, sorting, listing summaries, prices, availability, seller links | Catalog/filter components at `/marketplace`; separate commerce taxonomy, listing, and seller models | MVP | Published eligible listings are searchable and filterable; empty taxonomy works; all discovery requires authentication |
| Image 1: favorites, messaging, purchase icons | Persistent favorites, seller conversation action, explicit payment-unavailable purchase treatment | MVP / Paid | Favorites survive reload; messages reach the intended seller; no apparent completed purchase before funding exists |
| Image 1: seller enrollment and badges | Self-service seller onboarding; evidence-based status labels; moderation controls | MVP | Eligible members can open storefronts; no invented transaction history or quality certification |
| Image 2: create deal, active deals, archive, terms, explanation | Deal dashboard, status lists, terms panel, How It Works | MVP | Lists reflect stored states; awaiting-funding deals remain active |
| Image 3: account navigation | Unified account workspace with purchases, favorites, security, messaging | MVP | Working routes and permissions; unfinished financial actions are unavailable |
| Image 3: refunds and wallet | Financial workspaces behind the paid-release gate | Paid | Display only verified financial events |
| Image 4: profile, activity statistics, contact settings, notification and regional preferences | Extend current profile/settings; separate member-visible and private fields; English UI and saved IANA timezone | MVP | No private contacts or purchases in member projections; statistics have defined evidence |
| Image 4: Telegram notification integration | Optional external-channel integration; existing handle editing remains available privately | Later | Explicit opt-in, verified destination, revocation, and private notifications |
| Image 5: conversation search and empty state | Persistent inbox, username search, compose, unread state, pagination | MVP | Send/reload/recipient-read works; outsiders cannot enumerate conversations |
| Image 6: referral links, commissions, tiers, milestones, earnings | Affiliate domain independent of noncash community credits | Later, after Paid | Attribution and awards are idempotent; monetary earnings reconcile to verified eligible events |
| Image 7: deal name, respondent, payer, USD amount, terms | Validated deal form and immutable invitation terms | MVP | Both parties agree to the same version; acceptance stops at awaiting funding |
| Image 8: asset/network selection, top-up amount, balance | Future provider-backed wallet and ledger | Paid | Supported networks are verified; no invented balances or deposit guarantees |
| Written five-stage walkthrough | Invitation, agreement, chat, funding, delivery, confirmations, dispute, release/archive | MVP / Paid | Only the pre-funding subset is initially executable |
| Reference advertising, featured placements, seller tiers | Original optional discovery enhancements | Later | Clearly labeled placements, configured terms, no fabricated performance claims |
| Reference Board, News, Private Section | Existing Forum; announcements/help; existing private-subforum permissions | MVP | No duplicate forum or implied paid membership |

Security, scan processing, immutable snapshots, audit events, and transaction constraints below are independently designed behavior, not claims about the reference system.

## 4. Domain, identity, and database architecture

### Service boundaries

Continue the existing `src/domains` pattern:

- **Identity/access:** session, eligibility, roles, restrictions, profile projections.
- **Community:** existing thread/reputation services, forum queries, subscriptions and moderation.
- **Commerce:** sellers, taxonomy, listings, favorites, order snapshots.
- **Messaging:** conversations, participant authorization, sends, reads, blocking.
- **Delivery:** protected content, uploaded objects, revisions, entitlements.
- **Deals:** agreement versions, transition rules, confirmations.
- **Support/moderation:** cases, assignment, evidence access, decisions.
- **Notifications/audit:** transactional events, outbox delivery, read state.
- **Payments:** deferred provider boundary and financial accounting.

Server Actions remain thin: validate input, obtain the actor server-side, invoke a service, and return a minimal result. Route Handlers serve uploads/files and machine integrations. Do not add a parallel REST API for every operation.

Use server-only queries and services. Recheck current restrictions and resource ownership inside consequential transactions. Request-local memoization may deduplicate session reads; do not share user-specific results across requests.

### Schema reuse and additions

| Domain | Reuse | Add or extend |
|---|---|---|
| Identity | Users, accounts, sessions, profiles, roles, provisioning triggers | Profile visibility preferences, timezone, seller permission |
| Community | Categories, forums, access rules, threads, posts, edits, subscriptions, reputation, reports | Finish workflows; add constraints/indexes only where needed |
| Sellers | Canonical user ID | One seller profile per user; storefront, policy acceptance, active/suspended/closed status |
| Catalog | Existing PostgreSQL infrastructure | `marketplace_categories` with parent hierarchy; listings, immutable revisions, listing media, favorites |
| Orders | Users and seller/listing references | Orders, purchased revision/price/delivery snapshots, order events, one dedicated conversation |
| Delivery | Attachments and private storage | Protected listing content, delivery revisions, order/deal delivery associations, release authorization |
| Messaging | Conversations, members, messages, blocks, message attachments | Order/deal conversation kinds and unique resource links; operational send/read/archive workflows |
| Notifications | Existing notifications | Preferences, structured resource references, event deduplication, transactional outbox |
| Deals | Canonical participants and conversations | Deals, terms versions, acceptances, events, completion confirmations |
| Support | Existing moderation records where appropriate | Cases, participants, assigned staff, case events, evidence references |
| Audit | Existing moderation actions | Append-only domain audit events with actor, resource, action, reason, version and correlation ID |
| Financial, later | None of the noncash credit ledger | Provider events, payment attempts, balanced financial journals, transfers, refunds, reconciliation, withdrawal records |

Keep schema exports compatible while splitting the large schema module by domain as additions justify it.

### Data rules

- Preserve user IDs and existing account relationships.
- Use foreign keys, unique constraints, valid-state checks, positive amounts, and stable pagination indexes.
- Represent USD prices as integer cents using exact database/application arithmetic; serialize large integers safely.
- Store cryptocurrency amounts later in native atomic units with explicit asset and network identifiers.
- Never infer transaction success from a listing status, community reputation, vouch, or noncash credit.
- Use immutable snapshots for accepted terms and purchased content. Listing edits cannot alter existing agreements.
- Check optimistic versions or lock relevant rows during transitions. Store state change and audit/outbox records in one transaction.
- Repeated operation IDs return the recorded outcome; reuse with different input is rejected.
- Retain order/deal evidence rather than cascading it away when a listing or account is closed.

### Profiles and privileges

Self-service seller onboarding is the MVP default: an eligible member accepts seller policies, creates a storefront, and receives seller capabilities without staff privileges. Administrators may suspend sellers and remove listings.

Separate:

- Email verification.
- Community reputation/vouches.
- Seller policy status.
- Future verified transaction statistics.

Current profile projections include Telegram handles, credits, and aggregate community counts. Remove private fields from shared projections; existing contact details default to private unless explicitly opted into visibility. Activity and counts must respect the viewer’s forum permissions.

Support access is case-scoped and audited. Ordinary support staff must not obtain unrestricted message or financial authority through a generic administrator shortcut.

## 5. Taxonomy, listings, messaging, and delivery

### Catalog

- Support digital goods and services from launch.
- Categories/subcategories are administrator-configured and separate from forum categories.
- Create **no** arbitrary categories, listings, or sample copy.
- Listings may have no category. Hide empty category filters and present useful empty states.
- Prevent category cycles. Archive categories or detach listings rather than deleting listings with their category.
- Listing states: draft, published, paused, archived, removed.
- Seller owns draft/edit/publish/pause/archive actions; authorized moderators own removal/restoration.
- Require title, description, positive USD price, product kind, fulfillment mode, and applicable delivery details.
- MVP listings use unlimited availability or a manually controlled unavailable state. Do not add license-key allocation or physical inventory.
- Search only authorized, discoverable listing metadata. Never index protected deliverables.
- MVP paid checkout is unavailable. Offer contact-seller and optional create-deal actions with clear pre-funding copy.

### Messaging and notifications

- Reuse direct-conversation uniqueness and message request-ID constraints.
- Resolve usernames to canonical IDs; prevent self-conversations and enforce blocks for new direct contact.
- Validate reply references belong to the same conversation.
- Persist sends, attachments, unread cursors, archive/mute state, and search/pagination.
- Blocking does not erase order/deal evidence or prevent support intervention.
- MVP uses bounded polling while a conversation is visible; no new realtime platform.
- Generate in-app notifications transactionally. Deliver opted-in email through the existing Resend integration using an outbox and retryable worker.
- Reauthorize notification resources before displaying titles or destinations; do not include private message/delivery content in email.
- Maintenance must perform actual outbox and orphan-cleanup work, with authenticated invocation and observable failures.

### Flexible delivery

Fulfillment mode is independent of category and product kind:

1. **Automated protected text:** render authorized content in the order UI with accessible Copy feedback.
2. **Automated file delivery:** release approved file revisions after verified payment.
3. **Manual delivery:** seller submits text/files through the order/deal delivery panel associated with its private conversation.

Initial supported files: PDF, UTF-8 TXT, ZIP, JPEG, PNG, and WebP, using the current 10 MiB per-file limit. Additional types require an explicit allowlist change.

Extend the upload lifecycle:

- Authorize upload purpose and parent resource before signing.
- Quarantine uploads; verify actual size, checksum and content type.
- Scan files with an isolated malware-scanning worker; inspect ZIP contents with bounded expansion/depth and reject encrypted or uninspectable archives.
- Keep scan status separate from attachment lifecycle state.
- Fail closed when scanning is unavailable. Never mark an unscanned file ready.
- Re-encode images with existing Sharp processing.
- Preview text and processed images; serve PDFs as downloads initially. Do not render active HTML/SVG or arbitrary documents.
- Stream private downloads through an authorized application endpoint with no-store headers; do not expose storage keys or reusable public URLs.
- Bind each attachment to its authorized purpose/resource; an avatar attachment cannot be relabeled as a deliverable.
- Preserve immutable delivery revisions, timestamps, checksums, and buyer receipts.

In MVP, seller-owned delivery setup and ordinary conversation attachments work, but buyer access to protected order/deal fulfillment remains blocked. Conversation attachments do not establish payment or delivery completion. The platform cannot prevent someone manually typing information into a message, but it must never automatically expose protected listing payloads through chat.

After funding, access checks require both participant authorization and a valid release entitlement. Dispute freezes further automatic release; staff evidence access remains case-scoped. Refunds revoke future application retrieval, although already downloaded/copied material cannot be recalled.

## 6. Exact deal state machine

### Implement in the pre-funding MVP

| Transition | Actor and conditions | Atomic effects |
|---|---|---|
| Create → `DRAFT` | Eligible creator | Store creator-owned editable draft |
| `DRAFT` → `PENDING_ACCEPTANCE` | Creator; valid distinct respondent, payer, positive USD amount and complete terms | Freeze terms version; record creator consent; create dedicated conversation and invitation event |
| `PENDING_ACCEPTANCE` → `AWAITING_FUNDING` | Named respondent accepts the current version | Record respondent consent; state/event update; **no financial writes** |
| `PENDING_ACCEPTANCE` → `DECLINED` | Named respondent | Record decline; preserve evidence |
| `DRAFT` → `CANCELLED` | Creator | Record cancellation |
| `PENDING_ACCEPTANCE` → `CANCELLED` | Creator withdraws invitation | Record cancellation |
| `AWAITING_FUNDING` → `CANCELLED` | Either party while no funding attempt or funds exist | Record cancellation and notify the other party |
| Nonterminal → `CANCELLED` | Authorized case resolution for policy/abuse | Require reason, case and audit record; no refund claim |

**`AWAITING_FUNDING` is the final forward-progress state available in MVP.**

Additional rules:

- Creator selects whether they or the respondent pays; the other party is the payee.
- Resolve the username to a canonical user ID before invitation.
- Sending records creator consent; acceptance records respondent consent to precisely the same terms.
- Sent terms cannot be edited. Cancel and create a new invitation to change them.
- Create one conversation per deal when invited. Permit coordination and support requests before funding.
- No automatic funding expiry while funding is unavailable; accepted deals remain awaiting funding until cancelled.
- Active lists show pending and awaiting-funding deals; drafts are creator-only.
- Archive shows declined/cancelled deals initially and final financial outcomes later. Archive is a view, not a state that conceals unfinished obligations.
- Support cases use their own open/in-review/resolved/closed lifecycle. An unfunded support case must not imply frozen funds or a monetary dispute.
- Acceptance/cancellation races must commit only one valid transition.

### Deferred funded workflow

```text
AWAITING_FUNDING
  → FUNDING_PENDING
  → FUNDED
  → IN_FULFILLMENT
  → DELIVERED
  → COMPLETION_CONFIRMED
  → SETTLEMENT_PENDING
  → COMPLETED
```

- Funding attempts may expire or fail without payment. Return to awaiting funding only after evidence establishes no unresolved funds; retain every attempt.
- Only verified provider/chain evidence and balanced ledger posting can establish `FUNDED`.
- Automated fulfillment may advance directly from funded to delivered; manual fulfillment records commencement and delivery separately.
- Buyer acceptance and seller completion confirmation are separate, unique records for the applicable terms/delivery version.
- Both confirmations are required for ordinary escrow completion.
- Either party may dispute funded, unsettled performance. Dispute opening and settlement preparation must lock the same deal so a timely dispute blocks release.
- A dispute freezes further release and enters `DISPUTED`. Resolution may resume fulfillment or authorize seller settlement, refund, or a split outcome.
- Administrative resolution requires scoped financial authority, documented evidence, and independent approval. It is not an ordinary completion action.
- Refund paths use `REFUND_PENDING` → `REFUNDED`; split resolutions close only after every transfer is confirmed and reconciled.
- Settlement/refund failures remain pending with an operational issue. Never mark completion merely because a provider accepted a request.
- Post-settlement complaints remain support cases; they cannot retroactively pretend settled funds are still reserved.
- Once funding is initiated, cancellation must resolve in-flight, partial, or late funds before closing. It cannot use the unfunded cancellation shortcut.

### Standard purchases

Ordinary purchases use a separate order workflow and do not require escrow agreements or dual confirmations:

```text
AWAITING_PAYMENT → PAYMENT_PENDING → PAID
  → IN_FULFILLMENT → DELIVERED → COMPLETED
```

Payment, fulfillment and settlement statuses remain distinct. Payment failure, expiry, refund, and support paths retain their evidence. Standard purchase settlement timing and refund policy are paid-release decisions; do not silently apply escrow rules to every order.

MVP order pages show truthful empty/unavailable states. Do not fabricate orders or transaction history to populate the UI.

## 7. Crypto-only architecture and financial enablement gates

USD is the display/accounting currency. Cryptocurrency is the only payment rail.

Do not implement cards, wallet custody, deposit allocation, chain monitoring, fake funding, credits-to-cash conversion, fund reservation, settlement, refunds, or withdrawals during phases 0–6.

Document a future server-only payment-provider boundary covering:

- Quotes and funding instructions.
- Payment/deposit status lookup.
- Authenticated provider events.
- Supported asset/network capabilities.
- Settlement, refunds, withdrawals and reconciliation.

Do not implement a success-returning mock adapter in production.

| Financial capability | Evidence required before enabling |
|---|---|
| Funding initiation | Approved provider/custody model, jurisdiction/country policy, supported networks, quote/expiry rules and tested provider integration |
| Balance credit or paid status | Authenticated deduplicated event, authoritative status lookup, asset/network/amount match, confirmation/finality policy and balanced ledger posting |
| Reservation | Verified available funds, atomic sufficient-funds check, unique reservation and custody capability to honor it |
| Delivery release | Payment evidence plus committed entitlement, correct order/deal state, clean immutable delivery revision and resource authorization |
| Escrow completion | Required distinct-party confirmations or approved dispute resolution; no unresolved hold/dispute |
| Settlement | Authorized obligation, ledger reservation/debit, idempotent provider instruction, confirmed result and reconciliation |
| Refund | Authorized decision, remaining refundable amount, duplicate/over-refund prevention, confirmed provider outcome and compensating ledger entries |
| Withdrawal | Verified withdrawable balance, approved destination/security controls, provider support, applicable operating requirements and reconciled transfer |

Future ledger requirements:

- Immutable balanced journals with unique business/provider references.
- Exact USD and native-asset amounts; recorded exchange quote and fees.
- No floating-point financial arithmetic.
- Raw provider evidence stored securely with retention controls.
- Signature verification, event deduplication, replay handling and ordering tolerance.
- Recovery from the provider-success/database-failure window through idempotent lookup and reconciliation.
- Partial payments, overpayments, expired quotes, late deposits, wrong networks, reorganizations and reversals routed to explicit exception handling.
- Corrections use compensating entries, never edits to financial history.
- A release gate requires validated configuration and operational evidence; a feature flag alone cannot establish readiness.

Evaluate reputable providers against custody, deposits, escrow/reservation, payouts, network support, security, reconciliation, operational reliability and country availability. BTC, ETH, SOL, TRX and USDT ERC20/TRC20 are candidate requirements, not promises of support.

Provider selection, custody, jurisdiction, countries, fees, confirmation thresholds and refund/settlement policies remain deferred paid-release decisions. They do not block the pre-funding blueprint.

## 8. Migration and preservation strategy

### Shared procedure

Before any deployment migration:

1. Inspect schema, migration journal, table existence and row counts.
2. Back up the full database and referenced storage; verify restore into an isolated database.
3. Record user IDs, relationship counts, legacy listings, vouch references, forum/post counts and checksums.
4. Rehearse the appropriate migration path and validate it before production.
5. Use reviewed Drizzle migrations; do not substitute schema push or rewrite applied history.

### A. Fresh empty database

- Verify emptiness rather than assuming it from the previous session.
- Apply `0000`, `0001`, `0002` in journal order, then the new additive migrations.
- Preserve custom normalization and account-provisioning triggers.
- Bootstrap the intended administrator using the existing controlled process.
- Create no marketplace categories or example products. Existing minimal forum bootstrap is separate.
- Validate register → verify → username → eligible member, with no manual approval in public-registration mode.

### B. Database with legacy listings and unapplied `0002`

**Do not run the full migration journal before preservation. A migration after `0002` is too late to rescue dropped rows.**

Implement a pre-migration preservation command and migration-runner guard:

- Detect unapplied `0002` and existing legacy marketplace data; refuse progression without a verified preservation manifest.
- Export all `marketplace_listings` columns, related original thread types and content references, and `vouches.listing_thread_id`.
- Preserve identifiers, prices/currency, category strings, fulfillment descriptions, statuses, timestamps and relationships in restricted durable storage.
- Capture avatar references and synthetic-data cleanup candidates affected by `0002`; confirm the synthetic predicate excludes real accounts/content.
- Pause writes for the final snapshot and upgrade window.
- Apply unchanged historical migrations, then additive commerce migrations.
- Import legacy listings as unpublished drafts linked through a unique legacy-reference mapping. Preserve the original thread as forum content.
- Keep unknown historical values in the import record for review. Do not manufacture delivery payloads, payment evidence, sales history or configured categories.
- Original category strings remain preserved metadata until an administrator maps them.
- Make imports resumable and idempotent; compare record counts, references and checksums before enabling publishing.

If `0002` was already applied, restore missing legacy data from a backup into an isolated database and run the same mapped import. Without a backup, explicitly record the unrecoverable loss; do not invent original listings.

### Ordering, integrity and rollback

New schema order: identity/policy extensions → sellers/taxonomy/listings → message/delivery/outbox infrastructure → orders → deals/support/audit. Financial migrations come only in the approved paid phase.

Validate:

- User/account/profile/role identity preservation.
- Real forum posts, thread references, counters and permitted activity.
- Unique usernames, foreign keys, sequence positions and vouch mappings.
- Legacy source-to-draft import coverage.
- No unwanted marketplace seeds or cash-credit conversion.
- Private storage and authorization after migration.

Use expand/backfill/validate sequencing. Before reopening writes, a failed upgrade may restore the verified backup. After writes resume, prefer forward correction; restoring an old snapshot requires capturing and reconciling intervening writes. Never drop newly written commerce/deal data as a routine rollback.

## 9. Implementation phases

### Phase 0 — Recovery and baseline

**Prerequisite:** Current checkout.

- Save this roadmap when permitted; reconcile outdated README/analysis claims and record current versus historical verification.
- Add migration preflight/preservation tooling and disposable fresh/legacy migration fixtures before any upgrade.
- Add the reproducible production HTTPS verification runner described below.

**Acceptance/tests:** Recorded commit and clean baseline; preservation tests prove legacy data survives; fresh setup creates no marketplace categories; no live migration is performed merely to complete documentation.

### Phase 1 — Unified foundation

**Prerequisite:** Phase 0.

- Introduce auth/product route groups without changing established community URLs.
- Build sign-in/sign-up landing, guest redirects, validated return paths, authenticated shell and shared navigation.
- Consolidate actor/resource policies and domain-service conventions; retain current stack and privacy headers.
- Set release configuration to public registration while retaining guest gating and private-subforum restrictions.

**Schema/integrations:** Minimal identity preferences/permissions only; existing Better Auth and environment configuration.

**Acceptance/tests:** Guest HTML, RSC, metadata, files and APIs disclose no protected data; direct action requests cannot bypass authorization; verification/onboarding/reset/TOTP flows avoid redirect loops; ordinary members cannot access staff or another user’s records.

### Phase 2 — Forum and accounts

**Prerequisite:** Foundation.

- Preserve working create/reply/search/pagination; finish editing, soft deletion, history, subscriptions, reporting, moderation and profile sections.
- Complete account-security controls using existing Better Auth capabilities, including session revocation and recovery-code management.
- Fix contact visibility, misleading trust labels and permission-sensitive activity/counts.
- Persist subscriptions and introduce their notification events; add attachments after Phase 4 storage readiness.

**Schema/integrations:** Reuse community tables; extend preferences and audit records. Existing email/auth services.

**Acceptance/tests:** Changes survive reload; locked/private/deleted content behaves correctly; edits/deletes preserve evidence and counters; revoked access applies on subsequent requests; reputation is never labeled verified commerce.

### Phase 3 — Marketplace and sellers

**Prerequisite:** Foundation and canonical account eligibility.

- Build catalog, listing detail/editor, storefront and seller discovery/workspace.
- Add self-service seller onboarding, category administration, publish/pause/archive and moderation removal.
- Implement database search, filters, pagination and favorites; wire contact actions when Phase 4 messaging is available.

**Schema/integrations:** Sellers, separate marketplace taxonomy, listing revisions/media and favorites; private media processing from Phase 4 before upload-enabled release.

**Acceptance/tests:** Digital goods and services work without categories; sellers cannot edit each other’s listings; removed listings disappear from discovery; listing revisions preserve existing agreements; no seeded sample catalog.

### Phase 4 — Buyer experience, communication and delivery

**Prerequisite:** Foundation and commerce models.

- Complete persistent messaging, inbox search, read/archive/mute/block/report and notifications.
- Build account/favorites/order views and seller-owned text/file/manual delivery configuration.
- Implement quarantine, scanning, authorized streaming, resource attachments and real maintenance/outbox processing.
- Attach the same secure infrastructure to forum posts and conversations.

**Schema/integrations:** Extend existing messaging/attachments; add delivery revisions, order snapshots, outbox/preferences. Integrate private S3 storage, scanner worker, Upstash and Resend.

**Acceptance/tests:** Two-account communication persists and deduplicates; cross-conversation attachment/reply attacks fail; rejected scans remain inaccessible; unread counts persist; protected buyer delivery is denied throughout MVP; no fake order/payment records.

### Phase 5 — Pre-funding deals

**Prerequisite:** Identity, messaging, event/audit infrastructure.

- Build deal form, invitation/acceptance, dedicated chat, active/archive views and How It Works.
- Implement exactly the pre-funding transition table.
- Add support case creation, staff assignment, scoped evidence access and resolution.

**Schema/integrations:** Deals, immutable terms/acceptances, events, unique conversation links and support cases. **No financial integration.**

**Acceptance/tests:** Both payer choices work; self-deals and wrong respondents fail; repeated acceptance is idempotent; accept/cancel races resolve atomically; accepted deals stop at `AWAITING_FUNDING`; direct requests for every financial transition fail without financial writes.

### Phase 6 — Pre-funding MVP verification

**Prerequisite:** Phases 1–5.

- Finish essential user/seller/listing/category/community moderation, support, deal oversight and audit screens.
- Complete policies, useful empty/error/loading states, operational monitoring and backup/restore runbooks.
- Verify the deployed nonfinancial integrations and end-to-end authenticated workflows.

**Schema/integrations:** Only corrections justified by acceptance failures; no payment schema activation.

**Acceptance/tests:** All MVP gates below pass. Product copy explicitly states that paid checkout, funding and settlement are unavailable.

### Future paid-marketplace milestone

**Prerequisite:** Explicit approval and resolved financial decisions.

- Select and verify provider/custody capabilities.
- Add ledger, funding, the required production wallet, standard purchases, payment-gated delivery, funded escrow, disputes, settlement, refunds and applicable withdrawals.
- Complete sandbox failure/concurrency/reconciliation tests, then controlled authorized real-transaction acceptance.

**Acceptance:** Every enabled financial transition meets its evidence gate; no reliance on simulated production funding.

### Future advanced features and UI/UX

**Prerequisite:** Stable MVP; monetary incentives require the paid milestone.

- Affiliates/referrals, commission tiers, advertising, featured listings, promotions, advanced analytics and seller tools.
- Additional integrations, previews, personalization and visual refinement.
- Introduce each capability with its own measurable acceptance criteria and evidence-backed statistics.

## 10. Reproducible testing and release gates

### Production HTTPS runner

Add a repository-owned test runner during implementation that:

1. Runs the production build.
2. Starts `next start` on loopback port `3000`.
3. Generates a short-lived certificate in a temporary directory with localhost/loopback SANs.
4. Starts a Node HTTPS reverse proxy on `3443`, preserving host/origin and streaming behavior; set forwarded HTTPS correctly.
5. Runs Playwright using `PLAYWRIGHT_BASE_URL=https://localhost:3443` and `PLAYWRIGHT_LOCAL_HTTPS=1`.
6. Uses the same HTTPS origin for Better Auth and application configuration in authenticated test runs.
7. Captures failures/traces, closes processes and removes temporary certificates.

Keep production CSP, secure cookies and no-store assertions intact. Do not substitute development-server results for production acceptance.

Use disposable database fixtures for authenticated browser actors: unverified account, ordinary buyer, two sellers, restricted account, moderator and administrator. Reuse Vitest/PGlite integration conventions; add real PostgreSQL concurrency tests for locking-sensitive operations. External-service test isolation must remain clearly distinguished from deployed integration verification.

### Required regression coverage

- Registration, verification, username uniqueness, TOTP and session revocation.
- Guest redirects and direct API/action/file/RSC/metadata privacy.
- Cross-user, cross-seller, cross-conversation and private-subforum denials.
- Forum persistence, search, pagination, edits, deletion and moderation.
- Empty taxonomy, category changes, listing ownership and immutable revisions.
- Messaging duplicates, cursor pagination, blocks, notifications and retries.
- File-type spoofing, unsafe ZIPs, failed scans, wrong parent attachment and unpaid delivery denial.
- Deal payer selection, immutable consent, concurrency, cancellation, support access and every forbidden financial transition.
- Fresh and legacy migrations, restoration and idempotent backfills.
- Keyboard-only use, visible focus, error announcements, dialogs, Copy status, zoom/reflow and narrow layouts.
- Axe scans across authenticated buyer, seller, forum, message, deal and staff flows, supplemented by manual keyboard/screen-reader checks.

### Pre-funding MVP release gate

Release only when:

- All product content is authentication-gated.
- Verified registration grants access without manual approval.
- Existing identities and forum data are preserved.
- Catalog, seller management, messaging, favorites, notifications, moderation and deal/support workflows persist end to end.
- Categories are configurable and no arbitrary seeds are present.
- Accepted deals remain awaiting funding.
- Payment-gated content and financial operations remain inaccessible.
- Database, email, storage, scanning, rate limits, HTTPS and maintenance are verified in the target environment.
- Security, accessibility, regression and restore checks pass.

### Fully paid marketplace release gate

In addition:

- Provider, custody, jurisdiction, countries and financial policies are approved.
- Funding and balances derive exclusively from verified evidence.
- Ledger, reservation, delivery, settlement, refund and withdrawal operations reconcile correctly.
- Duplicate, delayed, reordered and failed provider events cannot double-credit or double-spend.
- Escrow ordinary completion requires both parties; dispute resolution is separately authorized and audited.
- Controlled real transactions verify enabled capabilities.
- Monitoring and recovery procedures cover outstanding customer funds and provider/database divergence.

**Remaining boundaries:** Saving `roadmap.md` awaits a mode that permits writes. Live services and the database require verification during implementation. Financial provider and operating-policy decisions remain blockers only for the future paid release. No further product clarification is needed to implement the pre-funding roadmap.

## 11. Finalization and targeted additions

The preceding remaining-boundaries sentence records the original planning status verbatim. **The file is now saved.** The original audit results remain historical results from this conversation; this documentation finalization does not claim a new application test run. Sections 11–16 supplement the preserved plan and are part of its acceptance criteria.

Authentication-gated discovery is an intentional, explicit user requirement: guests must reach sign-in/sign-up before accessing marketplace, seller, community or other product pages. Preserve the necessary auth/recovery and machine-endpoint exceptions in section 2. “Public profile” means information shared with eligible members, never anonymous visitors. Additional seller-profile and walkthrough screenshots were not available for direct inspection in this recovery; the user's descriptions establish their requirements. No reattachment is necessary to implement these described capabilities. Preserve GuildHarbor's original UI design freedom.

## 12. Shopping cart and checkout

### Pre-funding implementation

- Add authenticated `/cart` and `/checkout` routes, a header cart count, listing Add to Cart and single-item Review Purchase actions, and shared cart/checkout summary components. `/checkout` is a review-only experience until financial approval and verification; clearly state payments are unavailable and provide seller-contact/deal alternatives.
- Persist one active cart per canonical buyer in PostgreSQL, with unique cart/listing items, timestamps and a version. It survives refresh, sign-out and another-device sign-in. Do not create guest carts or store private cart contents in shared/browser caches.
- Support multiple distinct listings and sellers. Initial quantity is one per listing per checkout; adding the same listing is idempotent. A later repeat purchase creates a new order. No key inventory or physical quantities are introduced.
- Cart items reference live listings, not guaranteed prices or reservations. Revalidate listing publication, seller eligibility, ownership and current price on reads and checkout. Mark unavailable items explicitly; do not silently remove them or accept stale prices. Buyers cannot purchase their own listings.
- Single-item purchase uses the same validation/summary service with one selected listing and does not replace the user's cart. Multi-item purchase uses the selected cart items and groups them visually by seller.
- MVP review shows USD line prices and total, availability, seller, delivery method and the unavailable payment state. It creates no orders, payment attempts, reservations or delivery entitlements. Do not display fictitious fees or balances.

### Approved paid milestone

- Add `checkout_sessions`, immutable checkout lines and checkout-to-order links. A checkout contains one order per listing, including multi-seller checkouts; this preserves the existing one-order conversation, delivery and dispute boundaries. Do not combine different sellers' obligations into one order.
- Preparing checkout validates every selected line server-side, snapshots listing revision, seller, USD price, applicable configured fees/discounts and delivery terms, and creates `AWAITING_PAYMENT` orders in one transaction. If any selected line is invalid, create none and return specific corrections. Display a fresh summary for explicit buyer consent after any price change.
- The confirmed checkout has an expiring quote and idempotency key bound to buyer and payload. Set a 15-minute application quote lifetime, capped by any shorter provider quote lifetime. Expiry cancels unpaid orders only when there are no unresolved financial attempts; otherwise reconcile first.
- Required wallet balance is the initial checkout funding source. Insufficient funds leads to the wallet top-up flow and then a fresh checkout validation; initiating or returning from top-up never marks an order paid.
- Under row locks, recheck all lines, quote validity, buyer/seller eligibility and verified available wallet balance; atomically debit the checkout total and allocate balanced journal entries to each order. The entire checkout payment succeeds or none does. Unique checkout payment references prevent double charges across retries/tabs. A concurrent seller removal or price change requires a new confirmed quote.
- Only committed verified ledger debit permits each order's `PAID` state and delivery entitlement. Client success URLs, submitted balances and unverified events cannot authorize payment. Fulfillment outbox jobs run after commit and are retryable without double delivery.
- Remove only successfully purchased cart lines, preserving unrelated or subsequently added items. A failed payment leaves the cart intact. The confirmation page lists each real order and its independent fulfillment status.
- Refunds, disputes and settlement operate per order with auditable allocation of the aggregate payment and configured fees/discounts. A seller sees only their own orders, never other sellers' lines or the buyer's wallet balance. Optional escrow remains a separate agreed deal flow, not a mandatory cart mode.

### Acceptance and phase placement

Phase 3 adds cart schema/services and Add to Cart; Phase 4 completes cart/review screens; Phase 6 verifies persistence, ownership, price changes, unavailable items, empty cart and payment gating. Paid tests cover single-item and multi-seller checkout, insufficient balance, competing checkouts, duplicate submissions, quote expiry, transactional rollback, independent deliveries and partial order refunds. Test money exclusively in isolated fixtures before approved real-transaction checks.

## 13. Seller information, verified reviews and Trusted Sellers

### Seller profile and review eligibility

- `/sellers/[username]` provides Information and Reviews navigation; `/sellers/[username]/reviews` is directly addressable and paginated. Information contains storefront description, member-since date, permitted contact information, active listings and separately labeled community and marketplace statistics.
- MVP renders real profile information and truthful review empty states: “No verified purchase reviews yet.” Do not render invented stars, reviews, purchase counts or Trusted Seller awards to populate the UI. Review submission activates only in the paid milestone.
- Add order-linked reviews with buyer/seller IDs, rating integer 1–5, review text, timestamps, revision history, moderation state and one seller response. Enforce a unique review per order, canonical buyer ownership, distinct buyer/seller and verified payment plus completed fulfillment. Pending/failed/unfunded/cancelled-before-fulfillment orders and unfunded deals are ineligible.
- A completed funded deal may receive a separately labeled verified-deal review using a unique deal link and the same payer/payee checks. Exactly one source (order or deal) is required. Keep verified-purchase and verified-deal totals distinguishable.
- Require 10–5,000 characters of plain-text review content. Buyers can edit or withdraw their own review; store immutable history and reapply moderation. Sellers may post one editable response up to 2,000 characters and report a review, but cannot edit, suppress or delete buyer feedback.
- Completed purchases that are subsequently refunded retain factual reviews with an accurate refunded-transaction label. Revoked/fraudulent payment evidence removes verified eligibility and excludes the review from aggregates after audited review. A refund or negative rating alone is not grounds for removal.

### Moderation and ratings

- Use `pending`, `published`, `hidden`, `withdrawn` states. Submissions and edits enter a staff moderation queue; edits to a published review keep its last approved revision visible until review. Moderators publish or hide with a reason, evidence and audit event; buyers receive a decision and appeal/support path.
- Apply published rules for personal information, threats, spam, irrelevant content and manipulation equally to positive and negative reviews. Financial transaction evidence remains staff-only; never expose order IDs, amounts or buyer private records in public-to-members review DTOs.
- Show arithmetic mean to one decimal, published eligible review count, rating distribution, and newest/rating filters. No reviews means no aggregate rating. Compute from eligible published revisions; refresh aggregates transactionally or through an idempotent event projection and reconcile them.
- Add `/admin/reviews` and seller review-response controls. Test buyer-only eligibility, one-source uniqueness, edits, moderation/appeal, refunds, self-review rejection, hidden-review exclusion and cross-seller authorization.

### Evidence-based Trusted Seller discovery

- Add `/sellers/trusted` and a documented eligibility explanation. This is authenticated discovery and is neither purchasable nor equivalent to email verification, community reputation or featured advertising.
- A versioned administrator policy must explicitly configure minimum verified completions, minimum published review count, minimum average rating, evaluation window and maximum upheld-dispute rate. No invented numeric thresholds or default awards: leave awards disabled until administrators publish a policy.
- Required invariants regardless of thresholds: active eligible seller; no active seller restriction or unresolved fraud hold; evidence comes from reconciled completed transactions and eligible reviews. Staff records establish upheld disputes, not raw complaint counts. Store evaluated metrics, policy version and grant/revoke timestamps.
- Reevaluate on relevant transaction/review/moderation events and a daily job. Suspension or loss of eligibility revokes visibility promptly. No manual bypass may fabricate qualifying evidence. Empty Trusted Seller discovery explains that no sellers currently qualify.
- Phase 3 builds Information/Reviews tabs and empty-state discovery; the paid milestone enables verified reviews, moderation, policy configuration and qualification. Reputation/vouches remain independent throughout.

## 14. Required production cryptocurrency wallet and account settings

### Required deferred wallet

**A production cryptocurrency wallet is a REQUIRED future feature, not optional.** Users must eventually fund USD-denominated marketplace balances using supported cryptocurrencies. Explicit approval is still required before implementing it. Completing the pre-funding MVP is not completion of the full required platform.

- Required routes: `/account/wallet`, `/account/wallet/deposit`, `/account/wallet/withdraw`, `/account/wallet/transactions`, and an owner-authorized transaction detail. Seller earnings/withdrawals reuse the canonical wallet and ledger rather than creating another customer identity/balance system.
- Dashboard distinguishes verified available USD balance, pending incoming deposits and actual reserved amounts. Pending deposits are not spendable; reserved amounts exist only after real funded transactions. In MVP omit monetary widgets or show “Wallet not available yet,” never fabricated $0 accounts or frozen balances.
- Top-up selects supported asset and explicit network, requests a USD amount, and shows provider-issued address/instructions, exact crypto quote, fees, expiry and confirmation status. Record asset atomic units, USD conversion basis and actual credited amount. Do not promise credit at a fictional fixed rate or instant finality.
- Deposit lifecycle: created → awaiting transfer → detected → confirming → credited; expired/failed/exception branches retain evidence. Unique provider/chain transfer identifiers ensure one credit; late/partial/excess/wrong-network deposits enter the approved exception process. An observed transfer is not sufficient for credit before required finality and ledger reconciliation.
- Withdrawals are required subject to approved operating/provider rules: select supported asset/network and validated destination, preview USD debit/crypto payout/fees, require recent authentication and configured 2FA controls, reserve verified available balance atomically, then submit idempotently. Distinguish pending review, submitted, confirmed, rejected and failed; release reservations only when nonpayment is established. No frontend private keys or seed phrases.
- Reorgs or reversed evidence trigger holds, compensating journals, investigation and blocked further spending as appropriate; never silently rewrite balances. Reconciliation compares customer liabilities, ledger totals and provider custody evidence. An unexplained discrepancy blocks affected financial operations.
- Required financial notifications cover deposit detection/confirmation/credit, withdrawal submission/completion/failure and refunds. Emit from committed events with deduplication; secure in-app records always persist. Optional channel preferences govern email delivery, not ledger/audit recording.
- Provider shortlist/evaluation and jurisdiction-specific policies belong to the approved crypto phase; this document selects no provider and makes no current claim of custody/compliance approval.

### MVP account feature timing

| Capability | Implementation and acceptance | Timing |
|---|---|---|
| Account summary, profile information, membership statistics | Reuse identity/profile records; viewer-permitted community counts; private buyer statistics only from actual orders; future financial statistics unavailable until enabled | MVP |
| Email | Show verified account email privately; changes use Better Auth re-verification, never direct profile writes that preserve false verification | MVP |
| Telegram and Discord | Optional validated contact fields; private by default with explicit member-visible choice; saving a handle does not connect notification delivery | MVP |
| Preferred contact method | Persist Email, Telegram, Discord or Any; reject selecting an unconfigured channel; Any means configured channels only | MVP |
| Notification preferences/toggles | Persist per-event/channel choices server-side with accessible saved/error state; recheck preferences when dispatching; essential security notices are clearly mandatory | MVP |
| Language | Persist selected supported locale; English is initial supported UI, with no nonfunctional language choices; additional translations later | MVP |
| Timezone | Valid IANA timezone, persisted and applied consistently; UTC default with an explicit browser-detected suggestion | MVP |
| Last-seen privacy | Persist show/hide; default hidden for existing and new users without explicit consent; suppress timestamp and derived presence in every shared query/API | MVP |
| Wallet dashboard, balances, deposits, withdrawals, history | Required provider-backed, reconciled wallet | Future crypto phase |
| Cryptocurrency/network selection and top-up | Only supported configured pairs, verified instructions and crediting | Future crypto phase |
| Financial notifications | Committed deposit/withdrawal/refund events and persistent read state | Future crypto phase |
| Telegram notification delivery | Verified opt-in linking, disconnect/revocation, private templates and retry/deduplication; distinct from contact information | Later enhancement |

Extend profile/preferences schema additively; do not overwrite or expose existing contact data. Phase 2 owns settings and privacy; Phase 4 owns notification dispatch. Test persistence after logout/login, invalid preferences, email re-verification, privacy in HTML/RSC/API and no Telegram sends merely from a saved handle.

## 15. Later seller advertising, promotions and affiliates

These systems are required roadmap coverage for later enhancements. Paid campaigns cannot execute before the approved wallet/ledger milestone. No arbitrary campaigns, placements with invented commercial rates, referral awards or promotion copy are seeded.

### Routes, domain and administration

- Seller routes: `/seller/advertising`, `/seller/advertising/new`, `/seller/advertising/[campaignId]`, `/seller/promotions`, `/seller/promotions/[promotionId]`.
- Administrator routes: `/admin/advertising/campaigns`, `/admin/advertising/placements`, `/admin/advertising/pricing`, `/admin/promotions`; reports are within the relevant campaign/placement screens.
- Add advertising campaigns, creative revisions, placement definitions, rate-card versions, bookings, campaign events and daily aggregate metrics. Add separate promotions, eligibility/targets, codes, redemptions and allocation records. Reuse seller ownership, private media scanning, moderation, outbox and financial journal infrastructure.
- Placements are administrator-enabled identifiers mapped to supported application components: catalog sponsored slots, featured-listing sections, seller-directory sponsored slots and member-home placements. Configuration cannot inject scripts/HTML or invent an unimplemented placement. All placements remain behind authentication.

### Campaign creation and lifecycle

- Seller chooses an owned active listing or storefront, approved placement, eligible category targeting (optional), start/end UTC instants, creative image/text, internal destination and budget. Category targeting remains optional when no categories exist. No private-message, purchase-history or sensitive-profile targeting.
- Validate seller ownership, listing publication, creative dimensions/type, destination allowlist, date interval, placement availability and quoted price. Private assets use existing processing; external tracking pixels/scripts are prohibited.
- Lifecycle: draft → submitted → approved awaiting payment → scheduled → active → completed. Rejected, cancelled and paused branches have explicit reasons/events. Administrative approval and verified charge are both required before scheduling/serving. Creative/destination edits require a new reviewed revision.
- First advertising release uses fixed-price exclusive placement bookings, priced in USD per 24 hours and prorated by minute with round-up to cents. Administrators configure rates and minimum/maximum duration; absent configuration makes booking unavailable. Pricing snapshots show total, interval and cancellation terms before consent. Do not introduce CPC/CPM billing or auction behavior in this release.
- Use short-lived booking holds during checkout; confirm schedule exclusivity transactionally after verified wallet payment. Expired holds release only when no unresolved payment exists. Unique campaign-payment references prevent duplicate charges; conflicting bookings fail without charge.
- Campaign eligibility is rechecked at serve time. Removed listings or suspended sellers stop serving immediately. Seller pause stops serving but does not extend a booked interval; disclose this before purchase. Seller cancellation refunds unused future time prorated to minutes; administrator policy removal uses the same unused-time calculation unless an approved documented rule requires a financial hold. Delivered time is not automatically refundable. Record every charge/refund through the financial domain and retain original records.
- Platform outage credits use measured missed booked time and audited staff approval; never fabricate impressions to compensate. Creative approval does not grant a Trusted Seller badge.

### Reporting and controls

- Display Sponsored/Promoted visibly and accessibly. Keep organic results and trust qualification separate from purchased placement; all promoted destinations still require current authorization.
- Count a viewable impression only when at least 50% of the placement is visible for one continuous second in an active tab. Use short-lived signed placement tokens and deduplicate one impression per member/campaign/placement per 30 minutes. Reject known bot/test/admin-preview traffic and malformed events. These are platform-measured counts, not an assurance that all fraud is eliminated.
- Record validated clicks through an internal redirect that reauthorizes the destination. Deduplicate reporting clicks per member/campaign/placement per 30 minutes; raw security evidence is restricted and retention-controlled.
- Reports show scheduled/delivered time, charged/refunded USD, valid impressions, clicks, CTR, and verified attributed orders/revenue. Define conversion attribution as the last eligible campaign click within seven days before a paid order for the advertised listing (or seller's listing for a storefront ad); exclude self-purchases, unpaid/cancelled orders and adjust for refunds. Record the attribution version. Never share buyer identity with advertisers through reports.
- Administrators manage placement availability, versioned rates, campaign review, pause/cancel decisions, fraud exclusions, refund approvals and reporting exports. Changes to rates affect new quotes, not accepted bookings. Audit all changes and show meaningful empty/reporting-delay states.

### Seller promotions

- Sellers create scheduled automatic discounts or coupon codes for their own listings: percentage in integer basis points or fixed USD cents, start/end time, total redemption limit, per-buyer limit and optional minimum eligible subtotal. Administrators may suspend promotions and create separately budgeted platform promotions.
- First release applies at most one promotion per order. If a buyer supplies an eligible code, use it; otherwise select the greatest eligible automatic discount, with promotion ID as stable tie-breaker. Do not stack discounts implicitly. Discount cannot exceed the eligible subtotal or make a paid item zero-priced; final item price is at least one cent.
- Validate eligibility and redemption limits under transaction locks at checkout payment; snapshots preserve terms and seller/platform funding allocation. Expired quotes and failed payments consume no redemption. Repeated requests cannot exceed caps. Successful redemption remains counted after refunds to prevent refund/reuse abuse; refund the actual paid allocation, never the original undiscounted price.
- Reports show uses, discount cost, net verified revenue and refund adjustments. Seller-funded discounts affect only their own orders; platform-funded promotions require an approved platform budget. Campaign placement, promotional discount and Trusted Seller qualification are separate concepts.

### Preserve affiliates

Keep all original affiliate requirements: referral links and Copy, persistent attribution, tier/commission configuration, milestones, eligible event awards and earnings history. Implement only after the paid milestone for monetary benefits. Do not copy reference rates, permanent-attribution promises or rewards without approved configured terms.

Use versioned attribution/commission rules, unique award-per-eligible-event constraints, self-referral/duplicate-account abuse controls, and refunds/reversals via compensating journals. Advertising conversion reporting must not overwrite affiliate attribution; each program records its independent basis. Commission, advertising and promotion funding must reconcile without double-counting earnings. Administrator review and seller/buyer privacy apply to all program reports.

### Acceptance

Test seller ownership, creative review, conflicting bookings, quote/rate changes, duplicate charges, expiry, serving suspension, prorated refunds, reporting deduplication, inaccessible destinations, attribution windows, refund-adjusted revenue, coupon concurrency and caps, discount selection and affiliate reversal. No paid campaign serves before verified payment; no ad purchase grants trust; no report displays fabricated performance.

## 16. Expanded feature map and implementation acceptance additions

This table complements every row of section 3; it does not claim inspection of unavailable images. “Described” means the user's supplied feature requirements, while “designed” identifies GuildHarbor implementation choices.

| Evidence/capability | Domain, routes/components | Timing | Acceptance |
|---|---|---|---|
| Observed catalog/header cart icons; designed persistence/checkout | Commerce cart and checkout at `/cart`, `/checkout`, cart count and review summary | MVP review; Paid execution | Persistent single/multiple-listing selection; no MVP orders/charges; verified atomic multi-seller payment later |
| Observed listing information, prices, availability and featured markings | Listing detail, availability state and Sponsored labels | MVP information; Later paid placement | Prices are stored facts; no false stock, trust or promotion claims |
| Described seller Information/Reviews tabs | Seller profile and verified review domain | MVP tabs; Paid review submission | Auth-gated information and truthful empty state; verified order/deal evidence required for reviews |
| Observed Trusted Sellers navigation; described evidence-based discovery | `/sellers/trusted`, versioned qualification policy | MVP empty discovery; Paid qualification | No arbitrary awards; grants/revocations trace to published metrics |
| Observed account summary/profile and described membership statistics | `/account`, `/settings/profile`, profile cards | MVP | Canonical identity and permission-filtered counts; no invented purchases |
| Observed Email/Telegram/Discord/preferred contact controls | Contact fields and privacy settings | MVP | Persistent validated values; private by default; no implied delivery integration |
| Observed notification area; described persistent toggles | `/settings/notifications`, notification outbox | MVP | Preferences persist and govern optional dispatch; failures visible |
| Observed language/timezone; described last-seen privacy | Profile preferences and safe profile DTOs | MVP | Supported locale only, valid timezone, hidden presence respected everywhere |
| Observed wallet/top-up/asset selection; described deposits/withdrawals/history | Required canonical wallet, ledger and financial notification events | Future crypto phase | Verified USD credits from supported crypto; reconciled withdrawals/history; no MVP financial execution |
| Observed Telegram connect action | Verified external notification-channel connection | Later | Separate explicit opt-in/revocation; never activated by handle alone |
| Observed escrow dashboard/form; described five-stage walkthrough | Deal creation, acceptance, chat, support, archive and How It Works | MVP nonfinancial; Paid funded stages | Immutable consent; awaiting-funding stop; dual confirmation and verified settlement later |
| Observed affiliate tiers, milestones, event awards and earnings | Affiliate attribution, configuration and journal-backed awards | Later after Paid | Configured rules; duplicate prevention; no seeded rewards or fake revenue |
| Observed advertising navigation/slots; requested campaign/pricing/reporting | Seller advertising, placement components and administration | Later after Paid | Approved funded bookings, explicit pricing, measured reports, audited refunds |
| Requested promotions and advanced seller tools | Seller coupons/automatic discounts and reporting | Later after Paid | Transactional limits, transparent applied discount, reconciled funding |
| Observed language icon, notices/news and private-section navigation | Supported locale control, Forum announcements, role-gated subforums | MVP | No fake translations or duplicate community; existing privacy retained |
| Observed help/support entry point | `/support`, cases and accessible help entry | MVP | Actual persisted support workflow; no unsupported live-chat claim |

### Consolidated phase additions

| Phase | Additional deliverables and dependencies | Required verification |
|---|---|---|
| 0 | Preserve original audit evidence; save this complete roadmap; include cart/review/preference schema ordering in migration fixtures | Document links, no secrets, preservation and no-seed assertions |
| 1 | Auth gate also covers cart, checkout, reviews, Trusted Sellers and later advertising/wallet routes | Guest redirect/API/metadata/RSC denial matrix |
| 2 | All MVP account/contact/language/timezone/presence settings | Persistence, email re-verification, private projections, meaningful toggles |
| 3 | Cart service; seller Information/Reviews navigation; honest Trusted Seller empty state | Owner access, no invented ratings, empty taxonomy |
| 4 | Persistent cart and single/multi-item review; notification preferences; no financial execution | Cross-device cart, stale price/unavailable item handling, no order/payment side effects |
| 5 | Preserve exact pre-funding deal transitions; review eligibility excludes unfunded deals | No acceptance-to-funded shortcut or unfunded reviews |
| 6 | Verify all new MVP acceptance criteria with the existing full gate | Authenticated E2E/accessibility and live nonfinancial integrations |
| Future crypto/Paid | REQUIRED production wallet, verified USD balances, deposits/withdrawals/history, financial notifications, checkout/order payment, verified reviews/trust evaluation | Ledger reconciliation, concurrency/idempotency, verified-purchase moderation and actual approved transaction checks |
| Later enhancements | Advertising/promotions specification, original affiliate scope, Telegram notification integration | Booking/redemption concurrency, fair moderation, measured reporting, privacy and financial reconciliation |

### Final delivery boundary

The complete blueprint is now delivered in this file. Implementation agents must execute phases 0–6 and their additions when authorized, preserving all original requirements. Future crypto funding/wallet/payment execution requires separate explicit approval; later paid advertising, incentives and promotion execution depend on that milestone. This handoff does not authorize destructive migration, custody deployment or a real financial transaction. Remaining provider, jurisdiction and rate/policy configuration decisions are explicit future release prerequisites rather than fabricated defaults. No further audit restart or reconfirmation of settled product requirements is needed.

## 17. Implementation execution record

### 2026-09-20 — Phase 0 local foundation

- Read the complete specification (sections 1–16); baseline is `085b85c` on `main`, with only this roadmap initially untracked. Historical audit findings remain historical. README now points to this execution record; REPO_ANALYSIS is explicitly marked superseded.
- Added guarded `db:inspect`, `db:preserve`, `db:verify-restore` and `db:migrate` commands, complete public-table preservation with checksums, private new-file permissions, journal-prefix/hash verification, transaction-scoped migration locking, changed-snapshot rejection, and mandatory preservation/restore receipt before `0002` on populated databases. Historical SQL is unchanged. See `MIGRATIONS.md` for full database/storage backup, restore, legacy recovery and rollback procedure. Legacy-to-commerce draft import remains a Phase 3 dependency, not completed here.
- Added repository-owned `test:production`: production build, temporary SAN certificate, streaming HTTPS proxy, production server, Playwright and cleanup. No CSP or cookie safeguards were weakened.
- Verification: lint and TypeScript passed; **72 tests / 11 files passed**, including disposable fresh/legacy preservation fixtures; production build passed; **12 production HTTPS browser tests passed** (desktop Chromium/mobile WebKit). Expected SIGTERM terminates the production server during runner cleanup.
- Live database migration/backup/restore and authenticated deployed services are not verified. No live migration was performed. Additive cart/preferences/review-ordering fixtures will be extended as those schemas are implemented. Financial and later paid specifications in sections 7, 12–16 remain deferred in full.

### Phase 1 — Implementation complete; release acceptance remains open

Implementing shared auth/product boundaries and safe return navigation while retaining independent service authorization and existing community URLs.

Phase 1 verification update: auth/product route groups preserve established URLs; proxy redirects unauthenticated documents, including future commerce/wallet/advertising URLs, to sign-in. Product layout and existing queries/actions separately enforce eligibility. Return paths reject external/malformed/auth-loop destinations and pass through password/social/onboarding/TOTP flows. Default registration is now public while explicit private mode remains supported; no approval rows were changed. Lint, TypeScript, **82 tests / 12 files**, production build, and **12 production HTTPS cases** passed. Browser coverage includes guest HTML/RSC/metadata/API privacy, forged session cookies, 320px reflow, keyboard skip navigation, and Axe WCAG scans of six auth/recovery pages in Chromium/WebKit. Authenticated external-service browser checks remain unverified. Primary commerce navigation will be wired with its actual Phase 3 destinations; restricted-account support is tracked with Phase 5 support.

### Phase 2 — Implementation complete; release acceptance remains open

Completing account privacy/preferences and permission-filtered community statistics before forum operations and account security controls.

Execution steering: at the user's request, stop repeated full-suite/build/production runs. Continue implementation and use compilation plus quick targeted checks at the end. Previously recorded verification remains scoped to the code at the time it ran, not later changes.

Phase 2 implementation update (not a full verification claim): additive `0003_profile_preferences` preserves existing contacts and defaults shared Telegram/Discord/presence to hidden; profile writes validate supported locale, IANA timezone and configured preferred contact in an actor-authorized transaction. Member DTOs now omit credits/global likes, suppress private contacts/presence at SQL projection, filter thread/post/community-feedback counts by visible forums, and exclude revoked badges. Forum timestamps use the viewer's saved timezone. Added account summary, Better Auth session revocation, recovery-code replacement/challenge, and current/new-email OTP verification. Added post editing with optimistic timestamps, soft deletion preserving history/counters, owner/staff history, subscriptions with transactional in-app reply notices, reporting, lock/pin controls and audited report decisions. New transaction authorization rechecks actor eligibility, assigned permissions and private-forum rules. Email dispatch preferences/outbox and attachments remain Phase 4 dependencies; broader staff controls remain Phase 6. No new full-suite results are claimed after the user's verification steering.

### Application implementation pass — phases 3–5 and remaining phase 6 controls

- Added additive commerce models and persisted seller enrollment/storefront, listing revisions, category administration, removal/restoration, seller suspension, catalog/search/filter routes, seller Information/Reviews tabs, truthful Trusted Seller discovery, favorites, cart and single/multi-seller review. Review creates no orders, balances, payment attempts or release entitlements. Protected text is encrypted with a dedicated deployment key.
- Added direct messaging composition and request-ID deduplication, participant authorization, reply validation, inbox search/archive/read/mute/block/report controls and visible-page polling. Conversation attachments use the same private resource processing as forum and seller files.
- Added persistent notification preferences, resource reauthorization, read actions, transactional notification/outbox records and authenticated maintenance delivery/cleanup. Email dispatch rechecks optional preferences and current account/resource eligibility; retries retain observable failures.
- Added isolated ClamAV scanner worker, bounded ZIP inspection, checksum/size checks, quarantine, Sharp image re-encoding, resource-bound private downloads and text/image previews. Seller delivery remains owner-only; PDF is download-only. Actual scanner/private-storage deployment remains a release prerequisite.
- Added draft/invite/accept/decline/cancel agreements, immutable sent snapshots/consent, dedicated conversations, active/archive pages and support linkage. Database state constraints contain only pre-funding states; acceptance stops at AWAITING_FUNDING. Support assignment gates audited evidence access and policy cancellation; restricted accounts retain account-help access.
- Added account, notification, seller-order and buyer-order interfaces without fabricated transactions; user/forum/category/listing/seller moderation, support queue, deal metadata oversight, audit and operations screens; gated help/rules/privacy/pre-funding terms.
- Added offline legacy import command preserving complete source records/checksums. Eligible mapped legacy records become unavailable unpublished drafts; missing enrollment/unknown values stay review records without fabricated policy consent, categories or financial history.
- This pass intentionally does not add tests or run suites, builds, Playwright/E2E or accessibility scans, per the user's latest instruction. Compilation is checked selectively. Live integrations, real PostgreSQL concurrency/restore verification and authenticated browser acceptance are not claimed complete. All required future wallet/paid/review/advertising/promotion/affiliate specifications remain explicitly deferred.

### Remaining application workflow completion — current pass

- Added seller-managed listing image galleries using the existing resource attachments and private scan/re-encode pipeline. JPEG/PNG/WebP only; the twelve-image bound includes the completing upload and is enforced under a listing lock. Published images require an eligible signed-in viewer and eligible seller; draft images remain owner-only. Removal is authorized and audited, and protected delivery files remain a separate owner-only purpose.
- Closed the upload-completion/cleanup race by holding the attachment row lock through the private-object write and rechecking cleanup state under lock. Re-encoded images must still fit the storage limit. Listing resource mutations use consistent seller/listing/attachment lock ordering.
- Added `0008_deal_request_version` so participant request deduplication binds operation IDs to the submitted agreement version as well as deal/action. Support cancellation also appends agreement history; no new financial state or operation was added.
- Completed group/badge assignment and revocation administration, configuration visibility, and member-activity pagination. Added notification pagination, support-case/queue/history pagination, and assigned-staff reply notifications. Notification visibility rechecks support assignment and permission without failing the whole inbox when a staff permission is revoked.
- Preserved safe return destinations across sign-up, email verification and social entry. Added password-confirmed authenticator removal through Better Auth; recovery codes are invalidated by the auth provider. Conversation read-status failures now have an observable retry message.
- Current verification: `bun run typecheck` passed after these changes; `git diff --check` passed. No tests were created or expanded, and no test suites, production builds, E2E runs or accessibility scans were run in this pass. Earlier phase results do not validate this new implementation.
- Release gates remain open: additive migrations have not been applied to a live database; provider credentials/configuration, private storage/scanner deployment, authenticated notification dispatch, backup/restore exercises, concurrency and authenticated browser acceptance remain unverified. Phase 6 deployment/acceptance is not complete. The user explicitly deferred those broad verification activities during this implementation pass.
- Still explicitly deferred: production wallet and custody, deposits/balances, payment execution, paid orders and protected buyer release, funded escrow, settlement/refunds/withdrawals, verified-purchase review qualification, paid promotion/advertising and affiliate incentives. Their specifications above remain intact; accepted deals stop at AWAITING_FUNDING.

### Signed-in home, database recovery and acceptance follow-up — current pass

- Replaced the forum-first `/` page with authenticated marketplace discovery. Desktop uses a marketplace search/category rail, vertically stacked listing rows and a seller/forum rail; the document order reflows left rail → listings → right rail on narrow screens. Empty taxonomy and catalog states use stored data only and do not create placeholder categories or listings.
- Extended the catalog projection with the seller's current private avatar route and the first ready, clean WebP listing-media attachment. Home rows render that authorized image boundary, title, description, current USD price, seller/profile link, seller avatar, cart action and seller-contact action. Owners receive an edit link instead of buyer actions; unavailable listings cannot be added to a cart but retain the authorized contact path.
- Added the conditional seller card and `Open a store` route. Members without a seller profile go to onboarding; existing active, suspended or closed sellers go to the workspace. Onboarding redirects existing sellers, and suspended/closed sellers cannot reach listing creation or editing controls. Seller profile pages avoid offering self-messaging.
- Added Top subforums ranked by the count of nondeleted discussions in forums the current viewer can read. Forums without visible discussions produce a useful empty state; private-forum names and counts are never queried into the result for an unauthorized viewer.
- Independent home reads run concurrently inside a streaming boundary. The global route error boundary remains the retry path, and the home has an explicit discovery loading status. The header now exposes the required primary destinations and persistent cart count, uses a wider responsive breakpoint, and supports Escape-close with focus restoration for its mobile navigation.
- Add-to-cart races now return an inline stale/unavailable result rather than throwing a page error. Repeated adds are idempotent without falsely advancing the cart version, and removing a missing item does not create a version change. Discovery mutations revalidate `/`; secure resource uploads infer only the supported allowlisted media types, show purpose-specific file guidance and surface the server's quarantine/scanner/storage reason. Concurrent gallery completion enforces the twelve-image limit under the listing lock and returns a clear conflict while leaving the extra upload quarantined. Notification email delivery now rechecks conversation mute state and assigned-support permission immediately before dispatch. Message composition rejects malformed usernames with an inline result at the service boundary.
- The configured live database was inspected without printing row contents. It already records all nine reviewed migrations through `0008`, so no migration was pending or applied in this pass. A mode-0600 public-table snapshot and a PostgreSQL custom-format backup were written outside the repository, restored into disposable PostgreSQL 18, and compared: all 56 public-table records/checksums matched; the restored database contained nine migration records, eight noninternal triggers and sixteen public sequences. This is a local database restore rehearsal, not a provider disaster-recovery or private-object restore exercise.
- Focused checks completed before the user's request to pause verification: 10 commerce/migration integration tests passed and 6 offline scanner parser/fail-closed tests passed. A production build completed. An authenticated production HTTPS browser attempt did not establish acceptance because the fixed-port runner reached stale development assets; 11 of 14 cases passed and the three failures were not accepted as product evidence. The runner now allocates unused ports, but it has not been rerun. The real-PostgreSQL concurrency suite was added and its environment-loading issue corrected, but it has not completed a successful run. Later edits in this pass have not received another lint, TypeScript, full-suite or build run, per the user's direct instruction to continue implementation without testing.
- Release gates still open: R2/private-object backup and retrieval, deployed ClamAV scanner, authenticated Resend delivery, Upstash enforcement, scheduler invocation, real-PostgreSQL concurrency results, production authenticated browser acceptance, full authenticated accessibility/manual keyboard review and a target-provider restore rehearsal. No configured credentials for R2, scanner, Resend or Upstash were available. Phase 6 and the pre-funding release gate remain incomplete.

## 18. Signed-in member home and discovery layout — requested 2026-09-20

**Status:** Implemented in the working tree. The `/` route is now the signed-in marketplace discovery page described below, with active-category links, current published listings, authorized listing media and seller avatars, conditional seller onboarding/workspace routing, and viewer-filtered Top subforums. The implementation and verification scope are recorded in section 17. Phase 6 remains open for the release gates listed there.

Use the screenshot attached to the current user conversation as **layout inspiration**, not as product content or branding. Keep GuildHarbor branding and the established authentication gate. The screenshot's listed goods, seller claims, balance, financial promises and marketplace copy are not source data for this product.

- Make `/` the signed-in marketplace discovery starting page. Use a three-column desktop layout: category/navigation rail on the left, a central vertical list of individual product rows, and a right rail. Reflow the same content into a usable single-column mobile layout without horizontal scrolling; retain keyboard access and visible focus.
- In the left rail, show marketplace categories and useful search/filter entry points. The user permits **lorem ipsum placeholder category copy for now**; keep that clearly provisional and do not present placeholder categories as working filters or seed them into persisted taxonomy. Use actual active categories for functional links when available.
- Each central row shows a product image at its left, title and concise description, price, seller name and seller avatar/profile link, an accessible **Add to cart** action, and an accessible mail icon for **Contact seller**. Reuse current authorized catalog, cart and message flows. Respect availability and ownership: do not offer a buyer action on the seller's own listing or on an unavailable listing. Do not imply that checkout, payment or delivery is live.
- In the right rail, include a **Start selling on GuildHarbor** card with an **Open a store** button linked to the actual seller onboarding/workspace route appropriate to the signed-in member. Use accurate fee and payment language only; do not copy the screenshot's fee or instant withdrawal claims.
- Directly below the seller card, add a compact **Top subforums** component with a clear link to `/forums`. Rank a small set of forums by real activity or counts, explain the ranking accurately, and include only forums visible to the current viewer. Link each item to its subforum. Provide a meaningful empty state when no permitted forums exist. This gives marketplace visitors an immediate invitation into the forum without displacing the product list.
- Load independent home data concurrently, keep server-rendered discovery content and small client action boundaries, and reuse existing design tokens/components. Extend read projections only with fields needed by the rows; authorize product images and seller avatars through their existing file boundaries. Provide loading/empty/error states and proportionate tests for the new behavior.

**Acceptance:** At desktop width, the left categories, center product rows and right selling/forum rail are all visible and ordered as above. At narrow mobile widths, all actions and content remain accessible. Rows render from current listings rather than the screenshot; links and actions reach working authorized routes. Top subforums never leak private-forum names or counts. No paid transaction, false seller qualification or unsupported financial claim is introduced.
