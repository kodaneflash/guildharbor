# Migration preservation and recovery

Run all commands from the repository root. Never use schema push or edit applied SQL. `bun run db:migrate` uses the guarded runner; calling Drizzle directly bypasses it and is unsupported. Historical migrations remain unchanged.

1. Disable application writes for the upgrade window. Inspect the intended database using `bun run db:inspect`. It reports only counts and a checksum, never row contents. Confirm the database identity in your operator console.
2. Take a full PostgreSQL backup (schema, records, sequences, triggers and migration journal) with your database provider or `pg_dump`. Back up all referenced private storage separately. Store both in restricted durable encrypted storage; record their checksums and retention. A JSON snapshot is not a substitute for these backups.
3. Before `0002` on a populated database, run `bun run db:preserve /restricted/path/snapshot.json`. The command writes a new mode-0600 file and refuses overwrite. It includes every public table: authentication records and other sensitive data must never be committed or printed. Preserve listings, original thread types, vouch listing references, avatars and synthetic-cleanup candidates. Review the cleanup predicate in unchanged `0002`; accounts with an authentication record are excluded.
4. Restore the full backup into an isolated database. With connection variables pointing exclusively to that restored database, run `bun run db:verify-restore /restricted/path/snapshot.json`. The receipt records a successful full public-row checksum comparison. Also verify restored sequences, triggers, journal, row relationships and storage retrieval. Keep the receipt beside the snapshot.
5. Repoint connection variables to the original database. Run `bun run db:migrate /restricted/path/snapshot.json`. The runner locks public tables, validates the applied journal prefix and SQL hashes, rejects changed snapshot contents, verifies the restore receipt, and applies pending SQL plus journal writes atomically. On failure the connection closes and the uncommitted transaction rolls back. Locks prevent writes between the final comparison and commit. Keep the maintenance window in effect until validation completes.
6. Validate canonical IDs, profiles/roles, real posts and replies, vouches, counters, usernames and private files before reopening writes. Preserve snapshots for the additive commerce legacy-import workflow. No catalog/category seeds are authorized. The runner does not bootstrap an administrator automatically.

For a genuinely empty database, `bun run db:migrate` needs no preservation manifest and applies the full journal in order. A database containing only initialized legacy tables/roles is conservatively treated as populated.

If `0002` already ran, it cannot recover dropped rows. Restore an older backup to an isolated database and capture the same snapshot there for the later mapped draft import. Without a backup, record the missing legacy data as unrecoverable. Never invent it or roll production backwards to recover it.

Before writes reopen, a failed upgrade may restore the verified backup. After writes resume, use forward correction; restoring old state requires capturing and reconciling all intervening writes. Do not drop new commerce or agreement records as rollback.

New schema ordering remains identity/preferences → sellers/taxonomy/listing revisions/favorites/cart → messages/delivery/outbox → order snapshots → deals/support/audit. Verified review submission and all financial schemas/execution remain deferred. Extend fresh/legacy fixtures for every new migration.

## Legacy mapped import

After additive migrations and seller self-enrollment, run `bun run db:import-legacy /restricted/path/snapshot.json`. It preserves each original listing, related thread, posts and vouch references with a stable checksum. Records with a canonical enrolled seller and valid USD price become unpublished unavailable drafts without categories or invented protected payloads. Others remain `needs_review`. Rerunning resumes pending records after seller enrollment and does not duplicate mapped listings. A changed source checksum is an error requiring manual reconciliation. Inspect `/admin/legacy-imports`; no source secrets are rendered there. Unknown currencies/amounts are retained for review rather than converted speculatively.

Protected text backups require the matching DELIVERY_ENCRYPTION_KEY; keep it in an access-controlled secret manager with rotation/version planning. Losing the key loses access to encrypted payloads. Never rotate by overwriting the only copy. No buyer decryption/release API exists in the pre-funding release.
