# Verification — September 12, 2026

## Passed

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

No Neon, Resend, R2, Cloudflare or OAuth credentials were present. No migration or bootstrap was run against a cloud database. No production domain, dashboard or DNS settings were changed.

- Neon network/pooling and the deployed migration must be checked against your configured database.
- Email delivery is captured inside the integration tests. Verify real verification/reset email delivery after configuring Resend.
- Social onboarding tests exercise actual Better Auth user-update hooks, but do not contact Google or Apple. Verify their complete redirect/callback flow with provider credentials.
- R2 object operations and URL signing are mocked in integration tests; actual bytes are validated and processed by the application. Verify signed PUT, CORS, scoped credentials, persistence after refresh, and denied guest retrieval against the private bucket.
- Turnstile responses are mocked. Verify a real widget and Siteverify with the configured hostname/action and the actual Cloudflare managed-challenge rule. Confirm previously public caches/storage endpoints are disabled or purged.
- Authenticated flows are integration-tested at the auth/service/database boundaries, not in a browser connected to Neon. Run the acceptance checklist below after configuration.

## Credentialed acceptance checklist

1. Apply migrations and bootstrap the verified administrator as documented in `README.md`.
2. Register a second account. Confirm pending copy before and after email verification and login. Attempt known thread/member/feed/file URLs; no content should be returned.
3. Approve that account in the queue. Confirm directory/forum access, create a thread, follow the redirect, refresh, and post a reply. Confirm both persisted contents remain. Reject another application and confirm it cannot read the same resources.
4. Register via an enabled social provider. Confirm username onboarding and pending review are required. Try an unavailable/reserved username and competing registrations; only one account may own a normalized username.
5. Change the approved member's password. Confirm the old password fails. Enroll an authenticator, confirm its code, log out, and verify that the next password login requires TOTP.
6. Upload an avatar and refresh the profile/header/directory/thread. Verify the bucket is private and the same application file URL fails for guest, pending and rejected sessions.
7. Confirm Cloudflare verification works on the deployed origin, and that HTML/RSC, APIs, feeds and private files bypass shared caching.

Local browser note: the first mobile run against plain HTTP could not load assets because the production CSP upgrades requests to HTTPS. All 12 cases passed after testing through a temporary local HTTPS proxy, without weakening CSP. `PLAYWRIGHT_LOCAL_HTTPS=1` only allows a self-signed certificate in the test browser; it is not an application setting.

## Community access modes

Verified against the current implementation:
- Lint and TypeScript: pass.
- Vitest: 70 tests across 10 files pass, using migrated PGlite and real Better Auth for integration coverage.
- Production build: pass; community pages remain dynamically rendered.
- Production Playwright over local HTTPS: 12 tests pass in public mode and 12 in private mode (desktop Chromium and mobile WebKit).
- Coverage includes guest pages, HTML/RSC, metadata, APIs, queries, Server Actions, feeds and files; pending public membership and reversal to private; explicit approval retention; account restrictions; social username eligibility; username uniqueness; thread/reply persistence; private avatars in both modes; password changes, TOTP and Turnstile.
- Storage and outbound email/OAuth provider services are isolated in integration tests; this does not represent a live external-provider deployment test.

No new mode migration is needed: public eligibility never writes approval. Existing approved rows retain explicit approval and pending rows require review again after switching back to private. Set COMMUNITY_ACCESS_MODE=public or COMMUNITY_ACCESS_MODE=private in Vercel and redeploy; omission defaults to private.
