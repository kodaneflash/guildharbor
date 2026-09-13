# GuildHarbor

Private community forum using Next.js 16 App Router, React 19, Better Auth, Drizzle and Neon PostgreSQL. Community content always requires authentication. Verified email and a unique username are required in both registration modes. Social users must finish username onboarding.

## Local development and production setup

1. Install dependencies with `bun install`. Copy `.env.example` to `.env.local` and set the values below. Never commit credentials.
2. Create a Neon PostgreSQL database. Set `DATABASE_URL` to its pooled connection URL and `DATABASE_URL_UNPOOLED` to its direct URL, with `sslmode=require`. Set `BETTER_AUTH_SECRET` to at least 32 cryptographically random characters. Set both `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the exact application origin, including the scheme; use HTTPS in production.
3. Configure Resend, verify your sending domain, and set `RESEND_API_KEY` and `AUTH_EMAIL_FROM`. Email verification and password reset require delivery. Missing email credentials do not grant access or print OTPs.
4. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for shared rate limiting. Protected posting, search and upload operations fail closed without this service in production.
5. Back up an existing database, then run `bun --env-file=.env.local run db:migrate`. This applies the full migration journal, including membership approval, username enforcement, role/profile provisioning, and removal of marketplace-specific schema. Do not substitute `drizzle-kit push`: custom provisioning and normalization triggers are part of the migration.
6. Run `bun run dev`. Register your administrator account, select a username and verify its email. Run `bun --env-file=.env.local run db:bootstrap your-verified-email@example.com`. This explicitly approves that account, assigns its administrator role, records the bootstrap, and creates a Community/General Discussion forum if absent. It creates no demo accounts or posts. Keep this operator command restricted to trusted administrators.
7. In private mode, log in and open `/admin/registrations`. Approve or reject applications there. Every existing account starts pending after the migration, including old administrators, until bootstrapped or reviewed. Approval of an unverified or username-less account does not grant access until those requirements are completed.
8. Replace `https://t.me/REPLACE_WITH_COMMUNITY_HANDLE` in `src/components/access-notice-client.tsx` with the real Telegram community URL, and remove “(placeholder link)” from its label.
9. Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build`, then start the production server with `bun run start`.

## Cloudflare visitor verification

The supplied image depicts a full-page security interstitial. It is consistent with a managed challenge; branding alone does not identify its provider. Use a **Cloudflare Managed Challenge at the edge for suspicious document requests**, plus **managed-mode Turnstile on registration and social sign-in initiation**. A social sign-in can create a new account, so it is verified too. Email/password login retains Better Auth's own password/TOTP protections.

Application implementation: the client submits `x-turnstile-token`; the Better Auth before hook calls Cloudflare Siteverify and checks success, hostname and the `registration` action. Invalid, absent, expired and reused tokens cannot authorize registration. Tokens are cleared after a failed attempt. Production registration and social initiation fail closed if the secret is missing. Local development skips verification only when the secret is absent. Membership remains independently enforced on the server.

Cloudflare setup:

1. Add the production domain to Cloudflare, complete DNS/nameserver setup, and proxy the application's hostname through Cloudflare. Use Full (strict) TLS with a valid origin certificate.
2. In **Turnstile → Add widget**, choose **Managed**, add the exact application hostname, and copy its site key and secret. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public) and `TURNSTILE_SECRET_KEY` (server only). Rebuild after changing the public key. The configured application origin must match the hostname Siteverify returns. Use a separate widget for staging. Never put the secret in a `NEXT_PUBLIC_` variable.
3. For local verification, register an allowed development hostname. Cloudflare test keys have artificial host/action behavior; the app intentionally validates real hostname/action claims, so use the mocked Siteverify tests for failure-path checks and a real widget for the final integration check.
4. In **Security → WAF / Security rules**, add a narrowly scoped Managed Challenge rule for suspicious browser document traffic using the risk signals available on your plan. Exclude `/api/*`, `/feeds/*`, `/_next/*`, and OAuth callbacks from HTML challenges; Turnstile protects the relevant application submissions. Avoid a blanket challenge on every asset or API request. A managed challenge is configured in Cloudflare, not reproduced by an application loading screen.
5. Configure a **cache bypass** rule for this application's HTML, RSC responses, APIs, feeds and files. Cache only static build assets. Do not use Cache Everything on the application. Purge any existing cached HTML, feeds and avatars when changing an already-public installation to private.
6. If the managed challenge must be unavoidable, restrict direct access to the origin using the hosting provider's supported origin protection. Application authentication/approval remain enforced even if someone reaches the origin directly.

References: [Cloudflare managed-challenge integration](https://developers.cloudflare.com/turnstile/tutorials/integrating-turnstile-waf-and-bot-management/), [Siteverify requirements](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

## Private R2 avatar storage

1. In **Cloudflare → R2 Object Storage**, enable R2 and create a bucket, for example `guildharbor-private`. Choose the region/jurisdiction appropriate for your deployment. Keep **Public Development URL disabled** and attach **no public custom domain**. If an older bucket was public, disable those public endpoints and purge their caches; application code cannot revoke a previously public URL by itself.
2. Under **R2 → Manage R2 API tokens**, create an account API token with **Object Read & Write**, limited to **this bucket only**. Use an expiry/rotation policy appropriate to your operation. Save its Access Key ID and Secret Access Key. Use the account ID shown by R2; it is not the token ID. The app needs get, put and delete object operations. It does not need bucket-management privileges.
3. Set these server-only environment variables:

   ```dotenv
   R2_ACCOUNT_ID=your-cloudflare-account-id
   R2_ACCESS_KEY_ID=your-scoped-access-key-id
   R2_SECRET_ACCESS_KEY=your-scoped-secret-access-key
   R2_BUCKET=guildharbor-private
   ```

   The endpoint is constructed as `https://<account-id>.r2.cloudflarestorage.com`, with S3 region `auto`. These instructions target the standard R2 endpoint; jurisdiction-specific endpoints require matching storage configuration before use.
4. In the bucket's **Settings → CORS policy**, set the exact origins used by your application:

   ```json
   [
     {
       "AllowedOrigins": ["https://community.example.com", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["Content-Type", "x-amz-checksum-sha256"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Replace the example hostname, remove localhost for a production-only bucket, and add a staging origin only if used. CORS permits the signed browser PUT; it does not make objects public. The request CSP already allows R2 upload connections.
5. Add an R2 lifecycle rule to delete objects under `quarantine/` after **one day**, so interrupted/invalid uploads expire. Do not expire the `avatars/` prefix. Replaced avatar objects are inaccessible through the application once unassigned; storage retention/deletion of historical avatar objects can be managed separately. The legacy maintenance endpoint does not claim to perform cleanup.
6. Restart/redeploy. Sign in as an approved member, go to **Settings → Profile**, and upload a JPEG, PNG or WebP up to 10 MB. The app signs a short-lived PUT, validates the actual size/checksum and decoded image, strips metadata by re-encoding to WebP, and atomically attaches it to the profile. Refresh and check the profile, header, directory and posts.
7. Confirm that requesting `/api/files/<id>` as a guest or pending/rejected user returns 401/403, even if the URL was previously known. Files are streamed only after authorization with `private, no-store`; no signed download URL is exposed. Image optimization is disabled for authenticated images. Old externally hosted avatar references are cleared during migration and require re-upload.

References: [R2 scoped tokens](https://developers.cloudflare.com/r2/api/tokens/), [R2 CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## Optional social providers and account security

- Google: create a web OAuth client, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and register `https://<app-host>/api/auth/callback/google` as the redirect URI.
- Apple: configure a Services ID and Sign in with Apple key, set the `APPLE_*` values in `.env.example`, and register `https://<app-host>/api/auth/callback/apple` as the return URL. Apple requires a public HTTPS callback.
- New social users are sent to `/onboarding/username`. Username availability is debounced; server validation plus a normalized, case-insensitive unique database index decides the final result under competing registrations. The database trigger creates profile/member-role records atomically for every new auth account.
- Settings → Security changes passwords with Better Auth and invalidates other sessions as part of password change. TOTP enrollment shows a setup key, then requires a valid authenticator code before enabling 2FA. Subsequent password logins require TOTP. Recovery-code management and session-revocation buttons are absent; Better Auth's underlying recovery/session protections remain. Email OTP sign-in is disabled because it is not an enabled product flow and the installed TOTP plugin does not guard that route. Social sign-in continues to rely on the social provider's authentication protections.
- Social-only accounts can use the verified email password-reset flow to establish a password before password/TOTP settings. No separate invitation-code mechanism exists.

## Migration and privacy notes

The migration converts selling/buying/service threads to discussions and preserves their posts. It preserves vouch thread references before removing listing-specific columns/table/enum. Only synthetic imported accounts identified by **both** the old `demo-member-` ID prefix and reserved `.invalid` email, with no auth account, are anonymized. Their synthetic posts are cleared and hidden; real member replies are preserved. Old marketplace forum containers remain ordinary forum containers to preserve user content.

Authorization is checked before rendering pages and before private queries/mutations. Membership requires a verified email, a valid username, active account status and eligibility under the centralized community access policy. Private subforum permissions are checked separately. Staff routes/actions require staff permissions. The member directory exposes only eligible active accounts. Messages are read from the database with conversation membership checks; no optimistic demo sends remain. Message composition and additional staff CRUD are outside this change.

No demo fallback is used when cloud services are absent. Guests see the private-community notice. Unexpected failures use a generic error boundary. Historical migrations are retained because existing databases need their migration history.

## Verification

See `VERIFICATION.md` for executed results and the remaining credential-dependent checks. Integration tests run the actual migration SQL, Drizzle queries/services and Better Auth against disposable PGlite PostgreSQL; they do not connect to Neon. Email and external storage/verification services are isolated in tests. End-to-end browser tests cover guest privacy and navigation without an authenticated cloud account.


## Registration mode (Vercel)

Set the server-only environment variable in the applicable Vercel environments and redeploy:

- `COMMUNITY_ACCESS_MODE=public`: open registration. Verified, active users with valid unique usernames receive normal member access automatically, including existing pending users.
- `COMMUNITY_ACCESS_MODE=private`: administrator approval is additionally required.

Omitting the variable defaults to **private**; any other value fails environment validation. The example environment uses public mode. This setting never makes community content accessible to guests.

No additional migration or bulk update is needed for this mode switch. Existing `membership_status=approved` records remain explicit approvals (administrator review/bootstrap); automatic public eligibility leaves `pending` untouched. Returning to private mode therefore denies automatic members until reviewed, while preserving explicit approvals, roles, profiles, threads, and replies. Do not bulk mark public registrants approved: that would make their approval permanent in private mode. The existing migration journal is still required when setting up/upgrading the database.

The administrator queue remains available in both modes. In public mode it lists accounts without explicit approval, including members who already qualify for access. Approve grants durable approval; reject denies membership in either mode. Rejected, restricted, suspended, banned and deleted accounts never gain access through the mode switch.

Mode handling lives in `src/lib/community-access.ts`, backed by the pure membership policy. Session checks, transactional write checks and directory/profile filtering use it. Private subforum and staff permissions remain additional checks; public mode grants no staff privileges. Pages, metadata, queries, Server Actions, APIs, feeds and private files retain their authentication checks and private/no-store delivery.
