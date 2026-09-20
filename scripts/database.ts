import { readFile, writeFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";
import { z } from "zod";
import { captureSnapshot, digest, publicTables, quoteIdentifier, requirePreservation, verifySnapshot } from "./migration-safety";

const command = process.argv[2];
const path = process.argv[3];
if (!["inspect", "preserve", "verify-restore", "migrate"].includes(command ?? "")) throw new Error("Usage: database.ts inspect | preserve <snapshot> | verify-restore <snapshot> | migrate [snapshot]");
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");
const pool = new Pool({ connectionString });
const client = await pool.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  await client.query("SELECT pg_advisory_xact_lock(714082915)");
  // Hold application writes through inspection, preservation validation and migration.
  const names = await publicTables(client);
  if (names.length) await client.query(`LOCK TABLE ${names.map(name => `public.${quoteIdentifier(name)}`).join(", ")} IN ACCESS EXCLUSIVE MODE`);
  const current = await captureSnapshot(client);
  if (command === "inspect") {
    console.log(JSON.stringify({ tables: Object.fromEntries(Object.entries(current.tables).map(([name, rows]) => [name, rows.length])), sha256: current.sha256 }, null, 2));
  } else if (command === "preserve") {
    if (!path) throw new Error("Snapshot path required outside the repository, on restricted durable storage");
    await writeFile(path, JSON.stringify(current), { mode: 0o600, flag: "wx" });
    console.log("Preserved all public tables, including legacy references and cleanup candidates. Full database/storage backup and isolated restore verification are still required.");
  } else if (command === "verify-restore") {
    if (!path) throw new Error("Snapshot path required; connect to the isolated restored database");
    const expected = verifySnapshot(JSON.parse(await readFile(path, "utf8")));
    if (expected.sha256 !== current.sha256) throw new Error("Restored database does not match preservation snapshot");
    await writeFile(`${path}.restore-verified`, JSON.stringify({ sha256: expected.sha256, verifiedAt: new Date().toISOString() }), { mode: 0o600, flag: "wx" });
    console.log("Restored public-table records match the preservation snapshot.");
  } else {
    const journal = z.object({ entries: z.array(z.object({ when: z.number(), tag: z.string().regex(/^\d{4}_[a-z0-9_]+$/) })) }).parse(JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")));
    const exists = await client.query<{ present: string | null }>("SELECT to_regclass('drizzle.__drizzle_migrations')::text AS present");
    const applied = exists.rows[0]?.present ? (await client.query<{ hash: string; created_at: string }>("SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at")).rows : [];
    const migrations = await Promise.all(journal.entries.map(async entry => ({ ...entry, sql: await readFile(`drizzle/${entry.tag}.sql`, "utf8") })));
    for (const [index, migration] of applied.entries()) {
      const source = migrations[index];
      if (!source || Number(migration.created_at) !== source.when || migration.hash !== digest(source.sql)) throw new Error("Migration history differs from the reviewed journal; refusing to proceed");
    }
    const pending = migrations.slice(applied.length);
    const preserved = path ? verifySnapshot(JSON.parse(await readFile(path, "utf8"))) : undefined;
    requirePreservation(current, preserved, pending.some(entry => entry.tag === "0002_private_forum"));
    if (preserved) {
      const receipt = z.object({ sha256: z.string(), verifiedAt: z.iso.datetime() }).parse(JSON.parse(await readFile(`${path}.restore-verified`, "utf8")));
      if (receipt.sha256 !== preserved.sha256) throw new Error("Restore verification does not match snapshot");
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
    await client.query('CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)');
    for (const migration of pending) {
      for (const statement of migration.sql.split("--> statement-breakpoint")) if (statement.trim()) await client.query(statement);
      await client.query("INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)", [digest(migration.sql), migration.when]);
      console.log(`Applied ${migration.tag}`);
    }
  }
  await client.query("COMMIT");
} finally {
  // Closing an uncommitted connection rolls back on failure; never reuse it.
  client.release(true);
  await pool.end();
}
