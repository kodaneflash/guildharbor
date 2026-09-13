# GuildHarbor implementation analysis

Reviewed September 12, 2026. Scope: repository source, local development startup, public browser rendering, existing automated checks, and production compilation. Cloud credentials were not supplied; database migrations, real authentication, email delivery, and R2 uploads were not exercised. “Implemented” below describes code present, not an assertion that every configured integration has passed an end-to-end test.

## Overall assessment

GuildHarbor is a substantial community-forum and marketplace prototype with a polished responsive interface and meaningful backend foundations. It is not yet a complete, persistent community application. The central gap is integration: most pages always render fixtures even when a database is configured. Adding credentials alone will not finish the product.

Stack: Next.js 16.2.12 App Router, React 19.2.4, TypeScript, Tailwind CSS 4, Tiptap, Better Auth, Drizzle/Neon PostgreSQL, R2/S3, Upstash, Resend, Vitest, and Playwright. Cache Components is enabled. Database work is split between HTTP queries and pooled transactional operations.

## Local operation and asset fix

The development app runs at http://localhost:3000, bound to loopback. Dependencies were installed with Bun. No placeholder database credentials were copied into a local environment file: preview mode works without them.

The user's Chrome tab initially displayed an unstyled 404. Direct requests to the exact CSS, JS, and logo URLs returned HTTP 200 with correct content types. A hard refresh of the affected Chrome tab restored the homepage, styling, logo, and HMR connection. This establishes stale browser content as the immediate cause; the original source of that stale content was not proven. Logs also included an unrelated service-worker URL and browser-extension requests, but neither was established as the cause. No CSP protections were removed.

A separate reproducible problem affected avatars: fixtures reference an R2-backed endpoint that returned 404 without credentials. The endpoint now returns an initials-based WebP placeholder when R2 is unconfigured. UserAvatar also falls back to initials when any image fails. Actual remote portraits still require configured storage.

## Feature inventory

| Area | Present | Incomplete or missing |
|---|---|---|
| Global shell | Dark theme, semantic tokens, responsive navigation, breadcrumbs, loading and not-found UI, metadata, logo | Header always presents Aster and one unread message; it does not reflect the session. Members navigation opens Aster rather than a member directory. Footer policies link to `#`. |
| Homepage and forums | Category/forum rows, thread lists, counts, thread links, forum slug validation | Home and forum pages import demo data directly. Database forum/thread queries are not connected. Empty fixture forums display unrelated demo threads. |
| Forum controls | Search field, filter submission, sort button | Forum page ignores query parameters; sorting button has no behavior. No integrated pagination or unread tracking. |
| Thread reading | Title/type/badges, canonical slug redirect, post permalinks, invalid-ID handling | Thread lookup is fixture-only. Every thread renders the same two hardcoded PostCards, not its actual posts. Reply, quote, watch, report, and moderation flows are absent. |
| Thread creation | Tiptap editor and formatting; strict form validation; session and rate-limit calls; transactional creation of thread/first post; counter updates; redirect | Newly written database threads are not readable through the fixture-based detail route. Draft button has no handler. Marketplace fields are not captured or persisted into listing records. Errors are thrown rather than presented in a useful form state. |
| Marketplace | Listing-style thread types, policy messaging, filtered demo list, create-listing link | Search field is ignored. No complete listing create/edit/status/review workflow or structured ownership/fulfillment forms. Claims about verified fields and reviews exceed implemented behavior. |
| Search | Working title/creator substring search and type filtering over demo threads | No database full-text search, post-content search, members/forums search, relevance ranking, pagination, or wired search rate limit. |
| Public profiles | Overview and tab routing; fixture lookup; database fallback for active users | Known fixture users always take precedence. Threads/posts/reputation/vouches/listings sections show placeholder text. Badges/groups/signature include hardcoded values in database summaries. Verification indicators and scan claims are not derived from real verification records. |
| Trust scan | Display of age, reputation, vouch totals | “No changes,” “None” warnings, and “42” completed listings are hardcoded. It is not a computed trust report. |
| Authentication | Better Auth configuration; email/password registration and sign-in; OTP verification/reset; Google/Apple configuration; username onboarding; TOTP verification screen | Real flows need Neon, secret, mail and provider credentials. Security settings do not implement enrollment, code management, password changes, or session revocation. Header lacks live account/logout behavior. |
| Member provisioning | User status hooks, usernames, seeded demo profiles and roles | Normal auth hooks update status but do not create the profile and role records that the rest of the application expects. Public profile query uses an inner join, so a user without a profile cannot resolve normally. |
| Messages | Responsive conversation workspace, composer and local optimistic updates; membership-checked database message query | Sending only changes React state and is lost on reload. Conversations are fixtures. No persistent send/create flow, real conversation list, realtime delivery, attachments, search, archive, block, report, or read receipts. |
| Notifications | Styled fixture list and unread indicators | No user-specific loading, event generation, mark-read persistence, or live counts. |
| Profile settings | Display-name, contact, bio, signature fields | Hardcoded defaults; no save action or database persistence; no wired avatar/banner upload UI. |
| Reputation | Transactional give/reverse service functions and database list query | No connected UI action/API; role/eligibility checks are not orchestrated around these services. No complete public history or moderation reversal workflow. |
| Vouches | Tables, ratings/disputes schema, query and seeded examples | No submission, eligibility, dispute, review, or profile-history workflow. |
| Administration | Routes for forums, groups, badges, settings; shared table-style UI | All use static StaffPage content with inert Create/Review buttons. No CRUD or real role-aware admin page loading. |
| Moderation | Reports/users pages, report query, tables for restrictions/actions | Queue is static; no report submission, resolution, warnings, restrictions, appeals, or audit-producing workflow. |
| Uploads | Signing endpoint; quarantine keys; image size/type/checksum checks; Sharp processing; permanent-object transition | R2 and database required; not exercised. No integrated upload widget or attachment linking/display flow. Maintenance does not remove orphaned objects. |
| View counts | POST endpoint with deferred daily-bucket upsert | Thread page does not call it; no actual rollup implementation. Displayed counts are fixtures. |
| RSS | XML escaping, per-forum feed route, response cache headers | Feed reads fixtures, not live posts. |
| Maintenance | Bearer-secret validation and named tasks | Handler returns task names without performing any cleanup or rollups. No repository scheduling configuration found. |
| Credits/groups/badges | Database schema and presentation | No complete awarding, management, balance, or membership workflows. Credits are intentionally noncash. |

## Backend and integration findings

### Database foundation is broader than the working product

`src/db/schema/index.ts` and two migrations cover users/sessions/accounts, roles/profiles/groups, username history, forum access rules, threads/posts/edit history, reads/subscriptions/view buckets, listings, reputation/vouches/disputes, badges, conversations/messages/blocks, notifications, attachments, reports/actions/restrictions, credits, flags, and settings. Schema existence does not imply a working feature. The seed command inserts forum structure and demo community content, including synthetic reputation/vouch snapshots; it is not just a minimal production bootstrap.

Most query modules are unused by pages. The principal exception is public profile fallback. Thread creation is a real write path, but its read path is disconnected: create → transaction → redirect → fixture lookup. A database thread absent from fixtures will not display its stored content. Fix this before expanding secondary features.

### Authorization foundations need integration

`src/lib/permissions.ts` defines account-status and permission checks, but application code does not call `assertCan`. `requireSession` only checks session existence. Thread creation needs forum-access and account-status checks at its service boundary. Staff pages currently render static content and proxy checks do not establish a staff role. Connect role loading and resource authorization before adding live administration or sensitive data. These are source-level implementation findings; no exploitation was attempted.

### Error handling and operational completion

There is a not-found and loading UI, but no application `error.tsx` or `global-error.tsx`. Several mutations throw generic errors or collapse different failures into a single response. Account-flow fetches lack a network-exception message. Users need clear unavailable, validation, permission, and retry states.

Rate-limit configuration exists; thread/upload paths invoke it, and Better Auth has its own limits. Other named limiter categories are not a completed enforcement system. The helper permits unconfigured development and fails closed in production. Cache invalidation names are present in thread creation, but no matching application `cacheTag` consumers were found.

Security headers, nonce-based CSP, server-only modules, rich-text validation/sanitization utilities, and database constraints are useful foundations. README claims that every operation authorizes, rate-limits, and audits are broader than the connected implementation. This review is an implementation assessment, not an exhaustive security audit.

## Verification results

- Dependency installation succeeded.
- Homepage served HTTP 200 and rendered in both an automated browser and the user's Chrome tab after hard refresh.
- Referenced homepage JavaScript, stylesheet, and logo URLs returned HTTP 200 with appropriate content types.
- Initial lint and TypeScript checks passed.
- Initial unit/component suite: 6 files, 12 tests passed.
- Production build passed, including compilation, TypeScript and page generation (before the small avatar fallback changes).
- Initial Playwright suite: 3 passed, 3 failed. Two failures expect a homepage link named “GuildHarbor marketplace rules and safety guide” that is no longer in the rendered latest-discussion list. The third was a mobile page-load timeout while checks ran concurrently; that exact mobile layout test passed when rerun alone.
- Both desktop and mobile projects passed the existing 320px overflow checks.

Coverage is narrow: no configured auth/database/upload integration tests, mutation persistence tests, live permissions tests, or actual accessibility scan appear in the executed suite. An installed accessibility testing package is not equivalent to coverage. The missing homepage assertion should be updated to verify a stable navigation behavior rather than a stale fixture title.

## Recommended implementation order

1. Connect forum, thread, post, and listing reads to the database, with an explicit demo mode. Verify a newly published thread survives reload and displays its own content.
2. Complete normal-user profile/role provisioning, session-aware navigation, account-state enforcement, forum permissions, and staff guards.
3. Complete core forum actions: reply, edit, soft delete, drafts, pagination, subscriptions, and useful error feedback.
4. Persist profile settings and integrate the upload lifecycle, including attachment relationships and orphan cleanup.
5. Implement persistent messaging and user-specific notifications.
6. Complete structured marketplace listing creation/status/review and real reputation/vouch workflows.
7. Replace static moderation/admin screens with authorized database operations and audit records.
8. Finish database search, view rollups, maintenance scheduling, policy pages, member directory, operational monitoring, and integration/accessibility test coverage.

Payments and escrow are explicitly outside the documented MVP, so their absence is not an implementation defect. Likewise, credits are documented as nonredeemable; a cash ledger or payout system should not be inferred as required work.

## Final validation after the asset changes

Lint, TypeScript, and all 12 unit/component tests passed again after both avatar fixes. Browser verification on localhost:3000 showed the expected dark background, zero broken images, no framework error overlay, and no errors reported by the automated browser. Production build was not repeated for these small fallback changes. The development server remains running.
