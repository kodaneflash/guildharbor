# GuildHarbor

GuildHarbor is a dense, server-rendered community forum and curated lawful marketplace built with Next.js 16, React 19, Tailwind CSS 4, Drizzle, Neon, and Better Auth.

## Local development

```bash
bun install
cp .env.example .env.local
bun dev
```

The public UI renders lawful demonstration content without cloud credentials. Authentication, uploads, and mutations deliberately return an unavailable state until their required services are configured; there is no insecure mock login.

## Commands

```bash
bun lint
bun typecheck
bun test
bun test:e2e
bun build
bun db:generate
bun db:migrate
bun db:seed
```

## Infrastructure

- Neon PostgreSQL is the system of record. The app uses Neon HTTP for read queries and a pooled WebSocket connection for interactive transactions.
- Drizzle Kit owns migrations in `drizzle/`. The initial migration enables `citext` and `pg_trgm` before creating typed tables and indexes.
- Better Auth provides credential authentication, required usernames, Email OTP verification/recovery, Google and Apple OAuth, TOTP, encrypted recovery codes, and session management.
- Cloudflare R2 receives short-lived direct uploads into a quarantine prefix. Only JPEG, PNG, and WebP images up to 10 MB are accepted.
- Upstash Redis stores distributed rate-limit and temporary abuse counters only.
- Resend delivers authentication email.

Apply migrations and seed forum structure only after the Neon connection is configured:

```bash
bun db:migrate
bun db:seed
```

Google development credentials use `http://localhost:3000/api/auth/callback/google`.
Production credentials use `https://your-domain.com/api/auth/callback/google`.
Apple sign-in requires a public HTTPS callback at `/api/auth/callback/apple`; Apple does not accept localhost callbacks.

New Google and Apple accounts are created with `pending_username` status and
return to `/onboarding/username`. The onboarding route requires a valid,
email-verified session and protected routes remain unavailable until the member
claims a unique username.

Resend's `onboarding@resend.dev` sender is suitable only for sending to the
email address associated with the Resend account. Public registration requires
a verified sending domain.

## Security model

- Every database and auth module is server-only.
- Server Functions and Route Handlers authenticate, authorize, validate exact Zod inputs, and rate-limit mutations.
- Proxy redirects are navigation assistance only. Resource services remain the authorization boundary.
- Rich text is stored as validated Tiptap JSON, with derived plain text for PostgreSQL search and allowlist sanitization for rendered HTML.
- CSP nonces, secure headers, local redirect validation, idempotency constraints, soft deletion, immutable trust events, and audit records are part of the foundation.
- Marketplace listings prohibit credentials, identity data, unauthorized access, evasion, malware, manipulated engagement, and other unlawful or deceptive goods.

## Design tokens

The UI uses semantic variables in `src/app/globals.css`: page `#0f0f0f`, panels `#161616`/`#1c1c1c`/`#212121`, borders `#282828`, primary text `#f2f2f2`, secondary text `#b9b9b9`, and metadata `#898989`. Trust is `#50cd89`; category links are `#61b6cd`; selling is `#2196f3`; special states use cyan, pink, orange, yellow, and red.

Metadata was raised from the reference palette’s darker gray to `#898989`, giving approximately 4.6:1 contrast on `#212121`. The original saturated blue remains a badge/fill color; small linked text uses the lighter category cyan for AA contrast.

## Marketplace boundary

The MVP is a listing and discussion system, not a payment processor or escrow service. Reputation and vouches are community feedback, not identity, payment, quality, or safety guarantees. Credits are non-cash and nonredeemable.
