// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { afterAll, beforeAll, expect, it } from "vitest";

const pg = new PGlite({ extensions: { citext, pg_trgm } });
const source = "00000000-0000-4000-8000-000000000001";
const available = "00000000-0000-4000-8000-000000000002";
const reserved = "00000000-0000-4000-8000-000000000003";

async function post(reference: string, from: string, to: string, atoms: string) {
  return pg.query("insert into financial_journals (reference, debit_account_id, credit_account_id, amount_atoms, kind, actor_id, evidence_reference) values ($1,$2,$3,$4,'reservation','fixture','fixture-evidence')", [reference, from, to, atoms]);
}
beforeAll(async () => {
  const journal: { entries: { tag: string }[] } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const entry of journal.entries) await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
  await pg.exec(`insert into users (id,name,email) values ('fixture','Fixture','fixture@example.test');
    insert into financial_accounts (id,kind) values ('${source}','backing');
    insert into financial_accounts (id,owner_id,kind) values ('${available}','fixture','available'), ('${reserved}','fixture','reserved');`);
}, 30000);
afterAll(async () => { await pg.close(); });

it("posts exact balanced transfers and prevents insufficient-funds spending", async () => {
  await post("deposit-fixture", source, available, "9007199254740993");
  await post("reserve-fixture", available, reserved, "9007199254740992");
  await expect(post("double-spend", available, reserved, "2")).rejects.toThrow("Insufficient");
  const result = await pg.query<{ balance: string }>("select coalesce(sum(case when credit_account_id = $1 then amount_atoms else -amount_atoms end),0)::text as balance from financial_journals where debit_account_id = $1 or credit_account_id = $1", [available]);
  expect(result.rows[0].balance).toBe("1");
});
it("rejects duplicate financial references", async () => {
  await expect(post("deposit-fixture", source, available, "1")).rejects.toThrow();
});
it("keeps journal and account identity immutable", async () => {
  await expect(pg.exec("update financial_journals set amount_atoms = 1")).rejects.toThrow("immutable");
  await expect(pg.exec("delete from financial_journals")).rejects.toThrow("immutable");
  await expect(pg.exec("truncate financial_journals cascade")).rejects.toThrow("immutable");
  await expect(pg.exec("update financial_accounts set kind = 'pending' where kind = 'available'")).rejects.toThrow("immutable");
});
it("rejects invalid/unbalanced representations", async () => {
  await expect(post("zero", source, available, "0")).rejects.toThrow();
  await expect(post("negative", source, available, "-1")).rejects.toThrow();
  await expect(post("same", available, available, "1")).rejects.toThrow();
});
it("rolls back all transfers when any line fails", async () => {
  await expect(pg.transaction(async tx => {
    await tx.query("insert into financial_journals (reference,debit_account_id,credit_account_id,amount_atoms,kind,actor_id,evidence_reference) values ('rollback-first',$1,$2,1,'purchase','fixture','evidence')", [available, reserved]);
    await tx.query("insert into financial_journals (reference,debit_account_id,credit_account_id,amount_atoms,kind,actor_id,evidence_reference) values ('rollback-second',$1,$2,1,'purchase','fixture','evidence')", [available, reserved]);
  })).rejects.toThrow("Insufficient");
  expect((await pg.query("select id from financial_journals where reference like 'rollback-%'")).rows).toHaveLength(0);
});

it("keeps uncertain provider commands unrepeatable and prevents reassignment", async () => {
  const id = crypto.randomUUID();
  await pg.query("insert into financial_commands (id,owner_id,request_id,kind,request_digest) values ($1,'fixture',$2,'deposit',$3)", [id, crypto.randomUUID(), "a".repeat(64)]);
  await pg.query("update financial_commands set state = 'outcome_unknown' where id = $1", [id]);
  await expect(pg.query("update financial_commands set state = 'prepared' where id = $1", [id])).rejects.toThrow("cannot be retried");
  await expect(pg.query("update financial_commands set request_digest = $2 where id = $1", [id, "b".repeat(64)])).rejects.toThrow("immutable");
  await pg.query("update financial_commands set state = 'identified', provider_id = '123' where id = $1", [id]);
  await expect(pg.query("update financial_commands set provider_id = '456' where id = $1", [id])).rejects.toThrow("reconciliation");
  await expect(pg.query("delete from financial_commands where id = $1", [id])).rejects.toThrow("immutable");
  const history = await pg.query<{ state: string }>("select state from financial_command_events where command_id = $1 order by id", [id]);
  expect(history.rows.map(row => row.state)).toEqual(["prepared", "outcome_unknown", "identified"]);
  await pg.query("update financial_commands set state = 'identified', provider_id = '123' where id = $1", [id]);
  expect((await pg.query("select id from financial_command_events where command_id = $1", [id])).rows).toHaveLength(3);
  await expect(pg.exec("delete from financial_command_events")).rejects.toThrow("immutable");
  await expect(pg.exec("truncate financial_command_events")).rejects.toThrow("immutable");
});

it("separates payment and payout provider reference namespaces", async () => {
  const create = (kind: string) => pg.query("insert into financial_commands (owner_id,request_id,kind,request_digest,state,provider_id) values ('fixture',$1,$2,$3,'identified','123')", [crypto.randomUUID(), kind, "d".repeat(64)]);
  await create("withdrawal");
  await expect(create("withdrawal")).rejects.toThrow("unique");
  await expect(create("deposit")).rejects.toThrow("unique");
});

it("deduplicates immutable provider evidence independently of journal posting", async () => {
  const statement = "insert into financial_evidence (source,digest,encrypted_body,key_version) values ('ipn',$1,'encrypted','v1') on conflict do nothing";
  await pg.query(statement, ["c".repeat(64)]);
  await pg.query(statement, ["c".repeat(64)]);
  expect((await pg.query("select id from financial_evidence")).rows).toHaveLength(1);
  await expect(pg.exec("update financial_evidence set encrypted_body = 'changed'")).rejects.toThrow("immutable");
});

it("keeps withdrawal revenue distinct from member liabilities and conserves backing", async () => {
  const revenue = crypto.randomUUID();
  await pg.query("insert into financial_accounts (id,kind) values ($1,'platform_revenue')", [revenue]);
  await expect(pg.exec("insert into financial_accounts (kind) values ('platform_revenue')")).rejects.toThrow("unique");
  await expect(pg.query("insert into financial_accounts (owner_id,kind) values ('fixture','platform_revenue')")).rejects.toThrow();
  // Fixture only: a 100 USDT withdrawal, 1 USDT platform fee, 99 USDT
  // custody debit (recipient plus external costs). No provider transfer occurs.
  const insert = "insert into financial_journals (reference,debit_account_id,credit_account_id,amount_atoms,kind,actor_id,evidence_reference) values ($1,$2,$3,$4,$5,'fixture','confirmed-payout-fixture')";
  await pg.transaction(async tx => {
    await tx.query(insert, ["withdrawal-fixture:payout", reserved, source, "99000000", "withdrawal"]);
    await tx.query(insert, ["withdrawal-fixture:fee", reserved, revenue, "1000000", "withdrawal_fee"]);
  });
  await expect(pg.query(insert, ["withdrawal-fixture:fee", reserved, revenue, "1000000", "withdrawal_fee"])).rejects.toThrow("unique");
  await expect(pg.query(insert, ["fee-from-available", available, revenue, "1", "withdrawal_fee"])).rejects.toThrow("reserved funds");
  await expect(post("revenue-overdraw", revenue, available, "1000001")).rejects.toThrow("Insufficient");
  const balance = await pg.query<{ revenue: string; members: string; backing: string }>(`
    with balances as (
      select a.kind, coalesce(sum(case when j.credit_account_id = a.id then j.amount_atoms else -j.amount_atoms end),0) balance
      from financial_accounts a left join financial_journals j on j.credit_account_id = a.id or j.debit_account_id = a.id group by a.id
    ) select sum(balance) filter (where kind = 'platform_revenue')::text revenue,
      sum(balance) filter (where kind in ('available','pending','reserved'))::text members,
      sum(balance) filter (where kind = 'backing')::text backing from balances`);
  expect(balance.rows[0].revenue).toBe("1000000");
  expect(BigInt(balance.rows[0].members) + BigInt(balance.rows[0].revenue) + BigInt(balance.rows[0].backing)).toBe(0n);
});
