// @vitest-environment node
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { setTimeout } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const run = promisify(execFile);

/** Disposable local PostgreSQL only: no DATABASE_URL, host mounts or ports. */
describe.skipIf(process.env.FINANCE_POSTGRES_TESTS !== "1")("USDT PostgreSQL concurrency", () => {
  const container = `guildharbor-finance-test-${randomUUID()}`;
  let started = false;
  const backing = randomUUID();
  const available = randomUUID();
  const reserved = randomUUID();

  function query(statement: string) {
    return new Promise<string>((resolve, reject) => {
      const child = spawn("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"], { stdio: ["pipe", "pipe", "pipe"] });
      let output = "";
      let error = "";
      child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
      child.stderr.setEncoding("utf8").on("data", chunk => { error += chunk; });
      child.on("error", reject);
      child.on("close", code => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
      child.stdin.on("error", reject);
      child.stdin.end(statement);
    });
  }
  function transfer(reference: string, from: string, to: string, amount: string) {
    return `INSERT INTO financial_journals (reference,debit_account_id,credit_account_id,amount_atoms,kind,actor_id,evidence_reference) VALUES ('${reference}','${from}','${to}',${amount},'reservation','fixture','isolated-test');`;
  }

  beforeAll(async () => {
    await run("docker", ["run", "--rm", "--detach", "--network", "none", "--name", container, "--env", `POSTGRES_PASSWORD=${randomUUID()}`, "postgres:18"]);
    started = true;
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const result = await run("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]).then(() => true, () => false);
      if (result) { ready = true; break; }
      await setTimeout(100);
    }
    if (!ready) throw new Error("Disposable PostgreSQL failed to start.");
    const journal: { entries: { tag: string }[] } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
    for (const entry of journal.entries) await query(`BEGIN; ${await readFile(`drizzle/${entry.tag}.sql`, "utf8")} COMMIT;`);
    await query(`INSERT INTO users (id,name,email) VALUES ('fixture','Fixture','finance@example.test');
      INSERT INTO financial_accounts(id,kind) VALUES ('${backing}','backing');
      INSERT INTO financial_accounts(id,owner_id,kind) VALUES ('${available}','fixture','available'),('${reserved}','fixture','reserved');
      ${transfer("fixture-backing", backing, available, "100000000")}`);
  }, 30000);
  afterAll(async () => {
    if (started) await run("docker", ["stop", "--time", "1", container]);
  }, 10000);

  it("serializes competing payments and prevents double spending", async () => {
    const outcomes = await Promise.allSettled([
      query(`BEGIN; ${transfer("checkout-a", available, reserved, "60000000")} SELECT pg_sleep(0.2); COMMIT;`),
      query(`BEGIN; ${transfer("checkout-b", available, reserved, "60000000")} SELECT pg_sleep(0.2); COMMIT;`),
    ]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await query("SELECT count(*) FROM financial_journals WHERE reference IN ('checkout-a','checkout-b');")).toBe("1");
  }, 10000);

  it("enforces duplicate references across concurrent sessions", async () => {
    const outcomes = await Promise.allSettled([
      query(transfer("same-reference", available, reserved, "1000000")),
      query(transfer("same-reference", available, reserved, "1000000")),
    ]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(await query("SELECT count(*) FROM financial_journals WHERE reference = 'same-reference';")).toBe("1");
  }, 10000);

  async function purchaseFixture() {
    const buyer = `buyer-${randomUUID()}`;
    const seller = `seller-${randomUUID()}`;
    const buyerAvailable = randomUUID();
    const sellerPending = randomUUID();
    const listing = randomUUID();
    const revision = randomUUID();
    const firstQuote = randomUUID();
    const secondQuote = randomUUID();
    await query(`INSERT INTO users(id,name,email) VALUES ('${buyer}','Buyer','${buyer}@example.test'),('${seller}','Seller','${seller}@example.test');
      INSERT INTO seller_profiles(user_id,name,description,policy_version,policy_accepted_at) VALUES ('${seller}','Seller','Fixture','fixture',now());
      INSERT INTO listings(id,seller_id,title,slug,description,kind,fulfillment_mode,delivery_terms,price_cents,status)
        VALUES ('${listing}','${seller}','Fixture','fixture','Fixture','service','manual','Fixture terms',6000,'published');
      INSERT INTO listing_revisions(id,listing_id,version,title,description,kind,price_cents,fulfillment_mode,delivery_terms)
        VALUES ('${revision}','${listing}',1,'Fixture','Fixture','service',6000,'manual','Fixture terms');
      INSERT INTO financial_accounts(id,owner_id,kind) VALUES ('${buyerAvailable}','${buyer}','available'),('${sellerPending}','${seller}','pending');
      INSERT INTO financial_journals(reference,debit_account_id,credit_account_id,amount_atoms,kind,actor_id,evidence_reference)
        VALUES ('fund:${buyer}','${backing}','${buyerAvailable}',100000000,'deposit','${buyer}','isolated-fixture');
      INSERT INTO financial_purchase_quotes(id,buyer_id,seller_id,revision_id,amount_atoms,policy_version,evidence_reference,expires_at)
        VALUES ('${firstQuote}','${buyer}','${seller}','${revision}',60000000,'fixture','fixture',now()+interval '5 minutes'),
          ('${secondQuote}','${buyer}','${seller}','${revision}',60000000,'fixture','fixture',now()+interval '5 minutes');`);
    // Independent sessions use the same member/account locks, stable purchase
    // reference and order/journal invariants exercised by the service fixtures.
    const purchase = (quote: string) => query(`BEGIN;
      SELECT id FROM users WHERE id IN ('${buyer}','${seller}') ORDER BY id FOR UPDATE;
      INSERT INTO financial_journals(reference,debit_account_id,credit_account_id,amount_atoms,kind,actor_id,evidence_reference)
        SELECT 'purchase:${quote}','${buyerAvailable}','${sellerPending}',60000000,'purchase','${buyer}','fixture'
        WHERE NOT EXISTS (SELECT 1 FROM financial_orders WHERE quote_id = '${quote}');
      INSERT INTO financial_orders(quote_id,payment_journal_id,status,hold_until)
        SELECT '${quote}',id,'paid',clock_timestamp()+interval '24 hours' FROM financial_journals
        WHERE reference = 'purchase:${quote}' AND NOT EXISTS (SELECT 1 FROM financial_orders WHERE quote_id = '${quote}');
      SELECT pg_sleep(0.1); COMMIT;
      SELECT id FROM financial_orders WHERE quote_id = '${quote}';`);
    return { firstQuote, secondQuote, purchase, buyerAvailable, sellerPending };
  }

  it("commits only one competing 60-USDT purchase from a 100-USDT wallet", async () => {
    const fixture = await purchaseFixture();
    const outcomes = await Promise.allSettled([fixture.purchase(fixture.firstQuote), fixture.purchase(fixture.secondQuote)]);
    expect(outcomes.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(await query(`SELECT count(*) FROM financial_orders WHERE quote_id IN ('${fixture.firstQuote}','${fixture.secondQuote}');`)).toBe("1");
    expect(await query(`SELECT sum(CASE WHEN credit_account_id = '${fixture.buyerAvailable}' THEN amount_atoms ELSE -amount_atoms END)
      FROM financial_journals WHERE credit_account_id = '${fixture.buyerAvailable}' OR debit_account_id = '${fixture.buyerAvailable}';`)).toBe("40000000");
  }, 10000);

  it("serializes concurrent retries of the same order without charging again", async () => {
    const fixture = await purchaseFixture();
    await Promise.all([fixture.purchase(fixture.firstQuote), fixture.purchase(fixture.firstQuote)]);
    expect(await query(`SELECT count(*) FROM financial_orders WHERE quote_id = '${fixture.firstQuote}';`)).toBe("1");
    expect(await query(`SELECT count(*) FROM financial_journals WHERE reference = 'purchase:${fixture.firstQuote}';`)).toBe("1");
  }, 10000);

});
