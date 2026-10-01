# Implementation handoff

Continue from the user's latest request, not superseded instructions or reference-site policies.

Read applicable AGENTS.md, package.json, roadmap.md, docs/financial-architecture.md, docs/financial-operations.md and relevant source before changes. Preserve all existing uncommitted work. Use the existing Bun/TypeScript architecture; read installed version-matched framework documentation before framework changes.

Current source status is summarized in REPO_ANALYSIS.md. The core deposit → exact USDT balance → quoted vendor purchase → protected purchased-revision delivery → internal seller proceeds flow is connected. Maintenance recovers receipts/unidentified/known payments and settles eligible 24-hour seller holds. Manual seller fulfillment uses existing protected order pages and messaging. Financial execution and servicing remain hard-disabled. External cash-out, funded escrow, refunds and other enhancements remain excluded.

Remaining work is merchant and deployment acceptance, not rebuilding this flow: resolve the empty fixed-rate currency list, verify attributable USDT/Ethereum (ERC-20) final net settlement and one conversion pair, supply missing server-only configuration/asset approval evidence, preserve actual migration hashes and rehearse restored data, verify scheduler/operator ownership and the authenticated provider-backed acceptance journey. Read-only currency/merchant/minimum metadata is not settlement approval. Keep money movement disabled until explicit release authorization.

Ask the user before running tests, lint, type-check or build. Do not claim historical checks validate newer code. Record current outcomes and limitations in roadmap.md and VERIFICATION.md without accumulating contradictory progress notes.

Review MIGRATIONS.md before database work: migration 0002 has a pre-existing working-tree edit; compare applied hashes and rehearse pending migrations before any authorized upgrade. Do not inspect or expose secrets unnecessarily, call live provider mutations, or change deployed infrastructure without explicit authorization.

The October 1 USDT/Ethereum switch updated exact helpers, strict `usdterc20` settlement/backing/estimate checks, `eth` network validation and displays. `0017`/`0018` are applied to the configured database after full backup/restore rehearsal; all existing public records and historical SQL hashes were preserved. The approval manifest remains empty and both financial gates remain false. See current verification for the new focused results and unresolved provider gates.

Latest read-only follow-up: whitelisting fixed custody API access (HTTP 200; 2.477743 USDT/ERC-20 available, zero pending at the check). The authenticated merchant dashboard explicitly marks USDT on ETH as Primary. Do not repeat the superseded balance-403/unknown-primary blockers. Current detailed financial acceptance instructions are in FINANCIAL_HANDOFF.md and the current section of VERIFICATION.md.
