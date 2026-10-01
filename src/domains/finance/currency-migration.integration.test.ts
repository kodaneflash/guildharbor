// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { afterAll, beforeAll, expect, it } from "vitest";

const pg = new PGlite({ extensions: { citext, pg_trgm } });
let migration: string;
beforeAll(async () => {
  const journal: { entries: { tag: string }[] } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries.filter(entry => !entry.tag.startsWith("0018_"))) {
    await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
  }
  migration = await readFile("drizzle/0018_usdt_ethereum.sql", "utf8");
}, 30000);
afterAll(async () => { await pg.close(); });

it("refuses to relabel an existing USDC account", async () => {
  await pg.exec("BEGIN; INSERT INTO financial_accounts(kind) VALUES ('backing'); SAVEPOINT legacy;");
  try {
    await expect(pg.exec(migration)).rejects.toThrow("must not be relabeled");
    await pg.exec("ROLLBACK TO SAVEPOINT legacy;");
    expect((await pg.query<{ currency: string }>("SELECT currency FROM financial_accounts")).rows).toEqual([{ currency: "USDC" }]);
  } finally { await pg.exec("ROLLBACK;"); }
});

it("refuses a switch with an uncertain provider request even without a balance", async () => {
  await pg.exec(`BEGIN;
    INSERT INTO users(id,name,email) VALUES ('legacy','Legacy','legacy@example.test');
    INSERT INTO financial_commands(owner_id,request_id,kind,request_digest,state)
      VALUES ('legacy',gen_random_uuid(),'deposit',repeat('a',64),'outcome_unknown');
    SAVEPOINT legacy;`);
  try {
    await expect(pg.exec(migration)).rejects.toThrow("must not be relabeled");
    await pg.exec("ROLLBACK TO SAVEPOINT legacy;");
    expect((await pg.query<{ state: string }>("SELECT state FROM financial_commands")).rows).toEqual([{ state: "outcome_unknown" }]);
  } finally { await pg.exec("ROLLBACK;"); }
});

it("switches an empty ledger to USDT while retaining immutability and rejecting USDC", async () => {
  await pg.transaction(async tx => { await tx.exec(migration); });
  await pg.exec("INSERT INTO financial_accounts(kind) VALUES ('backing');");
  expect((await pg.query<{ currency: string }>("SELECT currency FROM financial_accounts")).rows).toEqual([{ currency: "USDT" }]);
  await expect(pg.exec("INSERT INTO financial_accounts(kind,currency) VALUES ('platform_revenue','USDC');")).rejects.toThrow("financial_account_currency");
  await expect(pg.exec("UPDATE financial_accounts SET currency='USDC';")).rejects.toThrow("immutable");
  expect((await pg.query<{ column_default: string | null }>(`SELECT column_default FROM information_schema.columns
    WHERE table_name='financial_deposit_requests' AND column_name='token_contract'`)).rows[0]?.column_default).toBeNull();
});
