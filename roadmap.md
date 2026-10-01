# Outlaw marketplace roadmap

**Source-audited 2026-09-29.** This file separates product requirements from current implementation. Sections 2–16 are the retained blueprint/acceptance requirements, not a claim that every listed feature or route exists. Sections 17–20 are the current source inventory and remaining work. Superseded chronological progress notes have been consolidated.

The working tree contains extensive uncommitted application, branding, financial and documentation changes. Preserve them. All financial execution is hard-disabled; credentials do not enable it. The core deposit, exact USDC wallet, checkout, protected delivery and seller hold settlement paths are connected and locally verified. Production activation remains blocked by merchant settlement/backing acceptance, configuration and deployment gates. Refunds and enhancements remain deferred. Section 20 supersedes earlier deposit-only implementation notes and historical future feature lists for the current scope.

## 1. Current repository and reading order

- Stack: Next.js 16.2.12 App Router, React 19.2.4, TypeScript, Tailwind 4, Better Auth, Drizzle/Neon, Bun, Vitest/PGlite and Playwright. Cache Components is disabled.
- Product: authenticated marketplace/community; current brand is Outlaw. Guest product pages redirect to sign-in. Public registration is the default, not public browsing.
- Implemented pre-funding code includes forum/accounts, seller/catalog/cart review, messages/files, notifications, unfunded agreements, support and administration. Deployed-service acceptance remains open.
- Finance: exact USDC ledger, disabled Direct Payments with a two-asset approval boundary, executable but gated checkout, protected buyer/manual seller delivery and scheduled internal seller hold settlement. Funded escrow and external withdrawals remain unavailable.
- Actual deal URLs are under `/escrow`, not `/deals`. Primary navigation is Marketplace (`/`), Forum, Escrow. Current source has seller/member detail routes but no `/sellers` or `/members` directory page; `/rules` and `/escrow/how-it-works` pages are also absent.
- Financial migrations 0009–0017 exist locally. No live financial migration is recorded. The last historical database inspection reported through 0008; current deployed state was not queried.
- An existing edit to migration 0002 must be compared with applied hashes before any migration. Do not claim historical SQL is unchanged or bypass the migration guard.
- Current flow verification is pending. Earlier test passes are historical, not certification of today's tree. Ask permission before the deferred tests/lint/type-check/build.

Read [current repository inventory](REPO_ANALYSIS.md), [financial architecture](docs/financial-architecture.md), [financial operations](docs/financial-operations.md), [verification status](VERIFICATION.md), and [migration safety](MIGRATIONS.md).

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
| Optional deals | Existing: `/escrow`, `/escrow/new`, `/escrow/[dealId]`, `/escrow/archive`; standalone walkthrough remains absent |
| Support | `/support`, `/support/cases/[caseId]` |
| Policies/information | `/help`, `/rules`, `/privacy`, `/terms`; all gated |
| Administration | Preserve current routes; add seller, listing, marketplace-category, support, deal-oversight, and audit screens under `/admin` |
| Paid milestone | `/account/payments`, `/account/refunds`, `/account/wallet`, `/seller/earnings`, `/seller/withdrawals` |
| Later enhancements | Affiliate, advertising, promotion, tier, and advanced analytics workspaces |

Current primary navigation: **Marketplace, Forum, Escrow**. Seller discovery/detail requirements below do not imply a directory route currently exists. Account navigation contains messages, notifications, favorites, orders, settings, and role-appropriate seller/staff entry points.

Reuse Outlaw’s semantic tokens and branding. Use a compact desktop header, accessible mobile navigation, responsive catalog cards, mobile filter sheets, and focused transaction detail pages. Do not reproduce STYX branding, advertising rails, product copy, or unsupported trust claims.

Build essential responsiveness and WCAG 2.2 AA into every phase; later visual refinement is additional polish.

## 3. Reference-to-feature map

The eight attached images were available for inspection. The additional five-stage walkthrough images were not attached here; their workflow is taken from the user’s written handoff.

**MVP** means pre-funding release. **Paid** requires the financial milestone's implementation and acceptance gates; implementation authorization does not authorize activation.

| Reference and evidence | Outlaw approach and domain | Phase | Acceptance |
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
- **Payments:** disabled financial domain; current coverage and gaps are in section 20.

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
| Financial | Separate from noncash community credits | Journals/commands/evidence/deposit/order foundations exist; funded escrow, payout and refund workflows remain absent |

Keep schema exports compatible while splitting the large schema module by domain as additions justify it.

### Data rules

- Preserve user IDs and existing account relationships.
- Use foreign keys, unique constraints, valid-state checks, positive amounts, and stable pagination indexes.
- Represent USD prices as integer cents using exact database/application arithmetic; serialize large integers safely.
- Financial code stores native USDC micro-units; retain explicit asset/network identity and never reinterpret USD cents as USDC.
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

Profile projections must preserve the implemented contact/presence privacy choices and viewer-filtered activity. Community credits and feedback are not financial balances or verified sales.

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

Payment, fulfillment and settlement statuses remain distinct. Payment failure, expiry, refund, and support paths retain their evidence. Standard purchase policy is immediate internal seller-pending credit with a 24-hour withdrawal hold, not escrow. Refund implementation is deferred.

MVP order pages show truthful empty/unavailable states. Do not fabricate orders or transaction history to populate the UI.

## 7. Crypto-only architecture and financial enablement gates

USD is the catalog price/reference currency; **USDC is the wallet accounting unit**. Native USDC on Base is the selected initial payment asset, subject to merchant verification.

Financial implementation has been authorized, superseding the original deferral. Keep execution disabled until acceptance. Current scope is the core deposit → USDC balance → purchase → protected delivery → internal seller proceeds flow; refunds and unrelated enhancements are deferred. Cards, fake funding and community-credit conversion are not part of this implementation.

The selected server-only Direct Payment boundary and remaining responsibilities cover:

- Quotes and funding instructions.
- Payment/deposit status lookup.
- Authenticated provider events.
- Supported asset/network capabilities.
- Settlement, refunds, withdrawals and reconciliation.

Do not implement a success-returning mock adapter in production.

| Financial capability | Evidence required before enabling |
|---|---|
| Funding initiation | Approved provider/custody model, supported networks, quote/expiry rules and tested provider integration |
| Balance credit or paid status | Authenticated deduplicated event, authoritative status lookup, asset/network/amount match, confirmation/finality policy and balanced ledger posting |
| Reservation | Verified available funds, atomic sufficient-funds check, unique reservation and custody capability to honor it |
| Delivery release | Payment evidence plus committed entitlement, correct order/deal state, clean immutable delivery revision and resource authorization |
| Escrow completion | Required distinct-party confirmations or approved dispute resolution; no unresolved hold/dispute |
| Settlement | Authorized obligation, ledger reservation/debit, idempotent provider instruction, confirmed result and reconciliation |
| Refund | Authorized decision, remaining refundable amount, duplicate/over-refund prevention, confirmed provider outcome and compensating ledger entries |
| Withdrawal | Verified withdrawable balance, approved destination/security controls, provider support, applicable operating requirements and reconciled transfer |

Financial invariants (implementation status in section 20):

- Immutable balanced journals with unique business/provider references.
- Exact USD and native-asset amounts; recorded exchange quote and fees.
- No floating-point financial arithmetic.
- Raw provider evidence stored securely with retention controls.
- Signature verification, event deduplication, replay handling and ordering tolerance.
- Recovery from the provider-success/database-failure window through idempotent lookup and reconciliation.
- Partial payments, overpayments, expired quotes, late deposits, wrong networks, reorganizations and reversals routed to explicit exception handling.
- Corrections use compensating entries, never edits to financial history.
- A release gate requires validated configuration and operational evidence; a feature flag alone cannot establish readiness.

NOWPayments Direct Payment REST and native USDC/Base settlement are selected. Admit exactly one additional evidence-approved conversion asset/network; no broader shortlist is authorized and no unverified option may be exposed.

Product policies are recorded in section 19; merchant capability, custody/finality semantics and production acceptance remain unresolved. Do not invent confirmation counts.

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
- Validate historical migration hashes and resolve the existing 0002 working-tree difference before applying pending additive migrations.
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

The repository-owned production HTTPS runner is implemented; its intended acceptance behavior is:

1. Runs the production build.
2. Starts `next start` on an allocated unused loopback port.
3. Generates a short-lived certificate in a temporary directory with localhost/loopback SANs.
4. Starts a Node HTTPS reverse proxy on an allocated unused port, preserving host/origin and streaming behavior.
5. Runs Playwright using the allocated HTTPS origin in `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_LOCAL_HTTPS=1`.
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

- Provider, custody and financial policies are approved.
- Funding and balances derive exclusively from verified evidence.
- Ledger, reservation, delivery, settlement, refund and withdrawal operations reconcile correctly.
- Duplicate, delayed, reordered and failed provider events cannot double-credit or double-spend.
- Escrow ordinary completion requires both parties; dispute resolution is separately authorized and audited.
- Controlled real transactions verify enabled capabilities.
- Monitoring and recovery procedures cover outstanding customer funds and provider/database divergence.

**Remaining boundaries:** Current release and financial acceptance work is listed in sections 17–20. No current deployed state is inferred from old verification records.

## 11. Finalization and targeted additions

Sections 11–16 retain product requirements and acceptance criteria. They are not an implementation inventory and do not authorize deferred enhancements during the deposit-only work.

Authentication-gated discovery is an intentional, explicit user requirement: guests must reach sign-in/sign-up before accessing marketplace, seller, community or other product pages. Preserve the necessary auth/recovery and machine-endpoint exceptions in section 2. “Public profile” means information shared with eligible members, never anonymous visitors. Additional seller-profile and walkthrough screenshots were not available for direct inspection in this recovery; the user's descriptions establish their requirements. No reattachment is necessary to implement these described capabilities. Preserve Outlaw's original UI design freedom.

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
- The confirmed checkout needs an expiring quote and idempotency key bound to buyer and payload. The original blueprint proposed a maximum 15-minute application quote lifetime; this is not implemented or a provider rate guarantee, and the executable rate/freshness policy still needs confirmation. Expiry cancels unpaid orders only when there are no unresolved financial attempts; otherwise reconcile first.
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

### Required wallet — implementation authorized, execution disabled

**A production cryptocurrency wallet remains required.** Implementation is authorized with USDC-denominated balances and USD reference pricing. The deposit flow is present but disabled and unverified; completing the pre-funding application is not completion of the financial platform.

- Current routes: `/account/wallet`, `/account/wallet/top-up`, `/account/wallet/deposits/[commandId]`. Withdrawal and full transaction-history routes remain future work. Seller earnings/withdrawals reuse the canonical wallet and ledger rather than creating another customer identity/balance system.
- Dashboard distinguishes available, pending and reserved USDC. Pending ledger funds mean held seller proceeds; unconfirmed deposits are separate observations, not booked balances. Reserved amounts require an actual obligation. In MVP omit monetary widgets or show “Wallet not available yet,” never fabricated $0 accounts or frozen balances.
- Top-up selects supported asset and explicit network, requests a USD amount, and shows provider-issued address/instructions, exact crypto quote, fees, expiry and confirmation status. Record exact USDC units, USD reference, provider evidence and actual credited amount. Do not promise credit at a fictional fixed rate or instant finality.
- Deposit lifecycle: created → awaiting transfer → detected → confirming → credited; expired/failed/exception branches retain evidence. Unique provider/chain transfer identifiers ensure one credit; late/partial/excess/wrong-network deposits enter the approved exception process. An observed transfer is not sufficient for credit before required finality and ledger reconciliation.
- Withdrawals are required subject to approved operating/provider rules: select supported asset/network and validated destination, preview USD debit/crypto payout/fees, require recent authentication and configured 2FA controls, reserve verified available balance atomically, then submit idempotently. Distinguish pending review, submitted, confirmed, rejected and failed; release reservations only when nonpayment is established. No frontend private keys or seed phrases.
- Reorgs or reversed evidence trigger holds, compensating journals, investigation and blocked further spending as appropriate; never silently rewrite balances. Reconciliation compares customer liabilities, ledger totals and provider custody evidence. An unexplained discrepancy blocks affected financial operations.
- Required financial notifications cover deposit detection/confirmation/credit, withdrawal submission/completion/failure and refunds. Emit from committed events with deduplication; secure in-app records always persist. Optional channel preferences govern email delivery, not ledger/audit recording.
- Provider selection is NOWPayments Direct Payment REST. Merchant custody/capability and compliance approval are not established by that selection.

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

This table complements every row of section 3; it does not claim inspection of unavailable images. “Described” means the user's supplied feature requirements, while “designed” identifies Outlaw implementation choices.

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
| Observed wallet/top-up/asset selection; described deposits/withdrawals/history | Required canonical wallet, ledger and financial notification events | Future crypto phase | Verified net USDC credits on Base; reconciled withdrawals/history; execution currently disabled |
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
| Future crypto/Paid | REQUIRED production wallet, verified USDC balances, deposits/withdrawals/history, financial notifications, checkout/order payment, verified reviews/trust evaluation | Ledger reconciliation, concurrency/idempotency, verified-purchase moderation and actual approved transaction checks |
| Later enhancements | Advertising/promotions specification, original affiliate scope, Telegram notification integration | Booking/redemption concurrency, fair moderation, measured reporting, privacy and financial reconciliation |

### Final delivery boundary

The complete blueprint is now delivered in this file. Implementation agents must execute phases 0–6 and their additions when authorized, preserving all original requirements. Financial implementation is authorized but production execution remains blocked; later paid advertising, incentives and promotion execution depend on the completed milestone. This handoff does not authorize destructive migration, custody deployment or a real financial transaction. Remaining provider and rate/policy configuration decisions are explicit future release prerequisites rather than fabricated defaults. No further audit restart or reconfirmation of settled product requirements is needed.

## 17. Current implementation inventory — 2026-09-29

“Implemented” means present in source; deployment and acceptance are separate.

| Area | Source implementation | Remaining boundary |
|---|---|---|
| Identity/accounts | Better Auth, verification/onboarding/TOTP, password/session controls, profiles/privacy/preferences, centralized eligibility | Credentialed email/OAuth/security/browser acceptance |
| Community | Persistent forums/threads/replies, edits/history, subscriptions, search, reputation/vouches and moderation | Deployed authorization/concurrency/accessibility acceptance; community feedback is not verified commerce |
| Marketplace | Seller enrollment/storefront, separate taxonomy, listing revisions/media, discovery/favorites | Private storage/scanner integration acceptance; no invented stock or trust metrics |
| Cart | Persistent quantity-one selections, availability/ownership checks, single/multi-item review | No payable checkout or quote consent |
| Messaging/support | Persistent conversations, deduplicated sends, attachments, unread/mute/archive/block/report; cases and scoped staff evidence | Deployed flow acceptance; terminal deal chat is not made read-only |
| Delivery | Private quarantine/scan/re-encode pipeline, seller encrypted text/files | Scanner/storage deployment; buyer payment path remains disabled |
| Notifications/maintenance | In-app notices/preferences/read state, optional Resend outbox, cleanup, authenticated maintenance endpoint | Scheduler/provider/monitoring acceptance |
| Agreements | Draft, invite, respondent accept/decline, cancellation, immutable terms/consent and chat | Stops at AWAITING_FUNDING; no reserved funds or funded settlement |
| Administration | Community/member/seller/listing/category/support controls, audit and operations | No complete financial approvals/exception-resolution console |
| Finance | Exact paired journals, commands/evidence, deposit code and wallet views, internal purchase/hold helpers, fee calculation | Hard-disabled and incompletely verified; see section 20 |

The latest implementation pass did not run tests, lint, type-check, build or live migrations. Historical results and their limited scope are consolidated in [VERIFICATION.md](VERIFICATION.md); no chronological “passed” claim below supersedes that boundary.

## 18. Signed-in home and current navigation

The `/` route is implemented as marketplace discovery with a search/product-kind rail, listing rows and a seller/Top subforums rail. Rows use stored listings and authorized media, seller/profile/contact and cart actions. Independent reads run concurrently within Suspense. Seller onboarding/workspace routing and viewer-filtered forum ranking exist.

The current left rail shows Digital goods and Services, not active category links. Category browsing exists at `/marketplace`; restoring a category rail would be a separate requirement, not completed code. Current navigation is defined in `src/components/navigation-config.ts`. Deleted directory/rules/walkthrough pages must not be advertised as existing routes.

Responsive/accessibility and authenticated production-browser acceptance remain open for the current UI. Do not reimplement the homepage from an old handoff or introduce reference-site branding/data.

## 19. Adopted financial policy and reference boundary

- NOWPayments server-only Direct Payment REST; no hosted checkout fallback.
- Native USDC on Base settlement plus one verified conversion pay-in, subject to merchant approval. Balances are USDC; catalog prices and deposit request references can display USD. Quote the current equivalent, never assume parity.
- Target pooled provider custody with the application's own ledger. Actual account backing/finality/settlement semantics remain unverified.
- Credit actual reconciled net USDC after fees; ambiguous deposits require manual review.
- Standard purchase pays seller pending internally at committed payment; escrow is optional and separately payer-authorized. Seller withdrawal hold is 24 hours after release.
- Zero initial platform fees for deposits/purchases/ordinary escrow. Every completed withdrawal earns 1% of total debit, rounded down to micro-USDC; evidenced provider/network costs are also deducted.
- Withdrawal security/limits: verified email, recent authentication, 2FA, destination-change hold 24 hours; 20 minimum / 500 per withdrawal / 1,000 rolling-day USDC including pending.
- Explicit financial roles and independent approval; no self-approval.
- Refund execution is deferred; post-withdrawal refund backing remains unresolved.
- Reference interfaces guide presentation only. Their custody, two-confirmation, network, fee, instant-withdrawal and no-appeal claims are not adopted.

These are approved product directions, not merchant approval or enabled functionality. [Financial architecture](docs/financial-architecture.md) is the authoritative implementation/policy boundary.

## 20. Core financial implementation — October 1, 2026

The later October 1 currency decision supersedes all historical USDC/Base policy references below: current settlement and the single-currency internal ledger are USDT on Ethereum (ERC-20). Source remains disabled pending merchant acceptance. No USD/USDT parity or USDC-to-USDT relabeling is assumed.

This section supersedes the September 29 audit and deposit-only current-state claims elsewhere in this historical roadmap. Implementation authorization is not activation authorization. [Architecture](docs/financial-architecture.md), [operations](docs/financial-operations.md), [verification](VERIFICATION.md) and [migration preservation](MIGRATIONS.md) describe the actual current boundaries.

### Connected, locally verified and disabled

- Exact USDT journals and balances; distinct selected-network pay-in and USDT settlement quantities.
- Evidence-approved two-asset manifest; merchant/native-contract/fixed-rate/minimum checks; Direct Payment address, local QR, memo, exact amount, expiry, honest estimates and final credited USDT.
- Authenticated callbacks, immutable encrypted raw evidence, exact-once backed net credit, retained-receipt/unidentified-command/known-payment maintenance and operator recovery without another POST. Sticky payment review and freeze on conflicting credited evidence.
- Buyer-bound five-minute exact USDT quotes, explicit charge consent, canonical member/account locking, multi-seller atomic journals/orders/cart changes and safe retries.
- Purchased-revision text/exact-file authorization, buyer/seller freeze checks, seller-owned encrypted manual fulfillment using protected order pages and existing messaging.
- Maintenance-driven 24-hour seller pending-to-available settlement exactly once. External cash-out remains unavailable.
- Additive `0017` marketplace migration and guarded `0018` USDT currency switch and isolated fresh-chain checks. Existing work, applied-history requirements and credentials are preserved.

### Required activation blockers

1. Resolve empty fixed-rate currency list and custody balance 403; verify merchant outcome/conversion settings, native USDT/Ethereum (ERC-20) final net settlement, BTC conversion, account fees/minimums, usable backing semantics and real signed IPNs. Currency metadata/merchant selection/pair minimums were read successfully; they do not prove settlement capability. No pay-in has been approved for exposure.
2. Supply missing server-only IPN/ticker/callback/evidence/delivery configuration and evidence-approved manifest; establish secure evidence/key ownership and the bounded listing-token/operator recovery process.
3. The configured database now has `0017` and `0018`: applied hashes matched, a full private backup was restored and rehearsed, and existing public records were preserved. Other deployment databases still require their own migration acceptance. Financial execution remains disabled.
4. Verify deployed authenticated maintenance/runtime, alerts and named reconciliation/incident operators; run the actual authenticated buyer/seller journey and provider acceptance with explicit authorization. Then obtain explicit activation approval.

### Optional future scope

External withdrawals, funded escrow, refunds, verified reviews/trust metrics, affiliates, advertising, advanced history/analytics and a financial console are not implemented by this pass. Their historical blueprint requirements do not block this narrower core marketplace release. They need their own authorization and acceptance.

Latest October 1 provider follow-up supersedes earlier 403/unknown-primary status: user IP whitelisting restored `/balance` HTTP 200, reporting 2.477743 USDT/ERC-20 available and zero pending at the check. The authenticated dashboard explicitly showed USDT on ETH as Primary. Fixed-rate currency availability remains empty; real payment/conversion/net-fee/IPN and configuration/operational acceptance remain outstanding. Both financial gates remain disabled. See FINANCIAL_HANDOFF.md and current VERIFICATION.md.
