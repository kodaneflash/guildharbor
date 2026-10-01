// @vitest-environment node
import { readFile } from "node:fs/promises";
import { createHmac, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { z } from "zod";
import * as schema from "@/db/schema";
import type { FinanceTransaction } from "./database";

type ProviderPayment = {
  payment_id: string; order_id: string; price_amount: string; price_currency: string;
  payment_status: string; pay_currency: string; outcome_currency: string;
  pay_address: string; pay_amount: string; amount_received: string | null;
  actually_paid: string | null; outcome_amount: string | null; payin_extra_id: string | null;
  network: string; network_precision: string; smart_contract: string | null;
  valid_until: string; is_fixed_rate: boolean; is_fee_paid_by_user: boolean; payin_hash: string | null;
};
const context = vi.hoisted((): {
  db: PgliteDatabase<typeof schema> | null; ownerId: string; failCreation: boolean; failLookup: boolean; creations: number;
  backingAtoms: bigint; payments: Map<string, ProviderPayment>;
} => ({ db: null, ownerId: "", failCreation: false, failLookup: false, creations: 0, backingAtoms: 9_000_000_000_000_000_000n, payments: new Map() }));
vi.mock("server-only", () => ({}));
vi.mock("./gate", () => ({ newDepositsEnabled: true, newPurchasesEnabled: true, financialServicingEnabled: true }));
vi.mock("@/lib/env", () => ({ env: { COMMUNITY_ACCESS_MODE: "public", NODE_ENV: "test" } }));
vi.mock("@/lib/session", () => ({ requireMember: async () => ({ user: { id: context.ownerId } }),
  getAccess: async () => ({ allowed: Boolean(context.ownerId), user: context.ownerId ? { id: context.ownerId } : null }) }));
vi.mock("@/db/client", () => ({ createReadDatabase: () => {
  if (!context.db) throw new Error("Fixture database unavailable.");
  return context.db;
} }));
vi.mock("@/db/transaction", () => ({ withTransaction: async (operation: (tx: FinanceTransaction) => Promise<unknown>) => {
  if (!context.db) throw new Error("Fixture database unavailable.");
  return context.db.transaction(tx => operation(tx));
} }));

import { createDeposit, persistDepositInstructions } from "./deposit-creation";
import { observeDeposit } from "./deposit-observation";
import { recoverDepositNotification, recoverDeposits } from "./deposit-recovery";
import { issueCheckout, commitCheckout, checkoutView } from "./checkout";
import { fulfillOrder, settleSellerHolds } from "./seller-orders";
import { settleStandardOrder } from "./purchase-flow";
import { buyerFileEntitlement, buyerOrder } from "./orders";
import { reconcileLedger } from "./reconciliation";
import { accountBalance, postJournal } from "./ledger";
import { lockFinanceAccounts, lockFinanceMembers } from "./flow-support";
import { formatUsdt, parseAssetAmount } from "./money";
import { parseProviderJson } from "./nowpayments";
import { POST as ipn } from "@/app/api/payments/nowpayments/ipn/route";
import { GET as delivery } from "@/app/api/orders/[orderId]/delivery/route";
import { financialPolicy } from "./policy";

const pg = new PGlite({ extensions: { citext, pg_trgm } });
const db = drizzle(pg, { schema });
const usdtContract = "0xdAC17F958D2ee523a2206206994597C13D831ec7";

beforeAll(async () => {
  const journal = z.object({ entries: z.array(z.object({ tag: z.string() })) }).parse(JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")));
  for (const entry of journal.entries) await pg.exec(await readFile(`drizzle/${entry.tag}.sql`, "utf8"));
  context.db = db;
  vi.stubEnv("NOWPAYMENTS_API_KEY", "isolated-provider-key");
  vi.stubEnv("NOWPAYMENTS_IPN_SECRET", "isolated-ipn-secret");
  vi.stubEnv("NOWPAYMENTS_IPN_CALLBACK_URL", "https://marketplace.example.test/api/payments/nowpayments/ipn");
  vi.stubEnv("NOWPAYMENTS_SETTLEMENT_TICKER", "usdterc20");
  vi.stubEnv("FINANCIAL_EVIDENCE_ENCRYPTION_KEY", "a".repeat(64));
  vi.stubEnv("FINANCIAL_EVIDENCE_KEY_VERSION", "v1");
  vi.stubEnv("DELIVERY_ENCRYPTION_KEY", "b".repeat(64));
  // Fixture approvals are not merchant capability acceptance.
  vi.stubEnv("NOWPAYMENTS_APPROVED_ASSETS", JSON.stringify([
    { ticker: "usdterc20", asset: "USDT", network: "eth", decimals: 6, tokenContract: usdtContract, memoRequired: false, verificationReference: "isolated-usdt-fixture" },
    { ticker: "btc", asset: "BTC", network: "btc", decimals: 8, tokenContract: null, memoRequired: false, verificationReference: "isolated-conversion-fixture" },
  ]));
}, 30000);
beforeEach(() => {
  context.failCreation = false; context.failLookup = false;
  context.backingAtoms = 9_000_000_000_000_000_000n;
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    const parsed = new URL(url);
    const path = parsed.pathname;
    if (path.endsWith("/full-currencies")) return Response.json({ currencies: [
      { code: "USDTERC20", enable: true, network: "eth", network_precision: 6, smart_contract: usdtContract, extra_id_exists: false },
      { code: "BTC", enable: true, network: "btc", network_precision: 8, smart_contract: null, extra_id_exists: false },
    ] });
    if (path.endsWith("/merchant/coins")) return Response.json({ selectedCurrencies: ["USDTERC20", "BTC"] });
    if (path.endsWith("/currencies")) {
      expect(parsed.searchParams.get("fixed_rate")).toBe("false");
      return Response.json({ currencies: ["usdterc20", "btc"] });
    }
    if (path.endsWith("/min-amount")) {
      expect(parsed.searchParams.get("is_fixed_rate")).toBe("false");
      return Response.json({ currency_from: parsed.searchParams.get("currency_from"), currency_to: "usdterc20",
      min_amount: parsed.searchParams.get("currency_from") === "btc" ? "0.0001" : "1" });
    }
    if (path.endsWith("/estimate")) return Response.json({ currency_from: "usd", currency_to: parsed.searchParams.get("currency_to"),
      amount_from: parsed.searchParams.get("amount"), estimated_amount: parsed.searchParams.get("currency_to") === "btc" ? "0.00123456"
        : formatUsdt(parseAssetAmount(parsed.searchParams.get("amount") ?? "0", 2) * 9950n) });
    if (path.endsWith("/balance")) return Response.json({ usdterc20: { amount: formatUsdt(context.backingAtoms), pendingAmount: "0" } });
    if (path.endsWith("/payment") && options?.method === "POST") {
      context.creations++;
      const request = z.object({ order_id: z.uuid(), price_amount: z.string(), pay_currency: z.string(), is_fixed_rate: z.literal(false), is_fee_paid_by_user: z.literal(false) }).parse(parseProviderJson(String(options.body)));
      const id = String(context.creations);
      const btc = request.pay_currency === "btc";
      const payment: ProviderPayment = { payment_id: id, order_id: request.order_id, price_amount: request.price_amount, price_currency: "usd",
        payment_status: "waiting", pay_currency: request.pay_currency, outcome_currency: "usdterc20", pay_amount: btc ? "0.00123456" : "19.9",
        pay_address: `0x${id.padStart(40, "0")}`, amount_received: "19.7", actually_paid: null, outcome_amount: null, payin_extra_id: null,
        network: btc ? "btc" : "eth", network_precision: btc ? "8" : "6", smart_contract: btc ? null : usdtContract,
        valid_until: new Date(Date.now() + 600_000).toISOString(), is_fixed_rate: false, is_fee_paid_by_user: false, payin_hash: null };
      context.payments.set(id, payment);
      if (context.failCreation) throw new Error("Provider accepted but response was lost.");
      return Response.json(payment);
    }
    if (path.includes("/payment/")) {
      if (context.failLookup) throw new Error("Isolated provider unavailable.");
      const id = path.split("/").at(-1);
      const payment = id ? context.payments.get(id) : null;
      if (!payment) return new Response(null, { status: 404 });
      return Response.json(payment);
    }
    throw new Error(`Unexpected isolated provider path ${path}`);
  }));
});
afterAll(async () => { await pg.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function member() {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, name: "Finance fixture", email: `${id}@example.test`, username: `u_${id.replaceAll("-", "").slice(0, 20)}`,
    emailVerified: true, accountStatus: "active", membershipStatus: "approved" });
  return id;
}
async function fund(id: string, amount = 100_000_000n) {
  await db.transaction(async tx => {
    await lockFinanceMembers(tx, [id]);
    const accounts = await lockFinanceAccounts(tx, [id]);
    await postJournal(tx, { reference: `fixture:${id}`, kind: "deposit", actorId: id, evidenceReference: "isolated-funds",
      debitAccountId: accounts.system("backing"), creditAccountId: accounts.member(id, "available"), amountAtoms: amount });
  });
}
async function balance(id: string, kind: string) {
  const [account] = await db.select().from(schema.financialAccounts).where(and(eq(schema.financialAccounts.ownerId, id), eq(schema.financialAccounts.kind, kind)));
  if (!account) return 0n;
  return accountBalance(db, account.id);
}
async function product(sellerId: string, mode = "manual", priceCents = 2000) {
  await db.insert(schema.sellerProfiles).values({ userId: sellerId, name: "Seller fixture", description: "Isolated seller profile", policyVersion: "fixture", policyAcceptedAt: new Date() }).onConflictDoNothing();
  const [listing] = await db.insert(schema.listings).values({ sellerId, title: "Purchased fixture product", slug: "fixture", description: "An isolated marketplace product",
    kind: "service", fulfillmentMode: mode, deliveryTerms: "Seller delivers the purchased result here.", priceCents, status: "published", available: true }).returning();
  if (!listing) throw new Error("Fixture listing unavailable.");
  const [revision] = await db.insert(schema.listingRevisions).values({ listingId: listing.id, version: listing.version, title: listing.title,
    description: listing.description, kind: listing.kind, priceCents: listing.priceCents, fulfillmentMode: mode, deliveryTerms: listing.deliveryTerms }).returning();
  if (!revision) throw new Error("Fixture revision unavailable.");
  return { listing, revision };
}
function paymentFor(command: string) {
  const payment = [...context.payments.values()].find(payment => payment.order_id === command);
  if (!payment) throw new Error("Fixture payment unavailable.");
  return payment;
}
function finish(payment: ProviderPayment) {
  payment.payment_status = "finished"; payment.actually_paid = payment.pay_amount; payment.outcome_amount = "19.7";
  payment.payin_hash = `0x${payment.payment_id.padStart(64, "0")}`;
}
async function creditCount(commandId: string) {
  return db.select().from(schema.financialJournals).where(eq(schema.financialJournals.reference, `deposit:${commandId}`));
}

it("credits authoritative net USDT once from a different-precision pay-in", async () => {
  const buyer = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20.00", currency: "btc" });
  finish(paymentFor(deposit.id));
  await observeDeposit(deposit.id, buyer);
  await observeDeposit(deposit.id, buyer);
  expect(await balance(buyer, "available")).toBe(19_700_000n);
  expect(await creditCount(deposit.id)).toHaveLength(1);
  const [record] = await db.select().from(schema.financialDeposits).where(eq(schema.financialDeposits.commandId, deposit.id));
  expect(record.requestedAtoms).toBe(123456n);
  expect(record.settledAtoms).toBe(19_700_000n);
});

it("durably receives signed duplicate callbacks and credits exactly once", async () => {
  const buyer = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  finish(paymentFor(deposit.id));
  const body = JSON.stringify({ order_id: deposit.id, payment_id: paymentFor(deposit.id).payment_id });
  const canonical = JSON.stringify(JSON.parse(body), ["order_id", "payment_id"]);
  const signature = createHmac("sha512", "isolated-ipn-secret").update(canonical).digest("hex");
  const request = () => new Request("https://marketplace.example.test/api/payments/nowpayments/ipn", { method: "POST", body, headers: { "x-nowpayments-sig": signature } });
  expect((await ipn(request())).status).toBe(200);
  expect((await ipn(request())).status).toBe(200);
  expect(await creditCount(deposit.id)).toHaveLength(1);
  expect((await db.select().from(schema.financialIpnReceipts)).filter(receipt => receipt.processedAt)).toHaveLength(1);
});

it("drains a retained callback after an interrupted lookup without depending on provider redelivery", async () => {
  const buyer = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  finish(paymentFor(deposit.id));
  const body = JSON.stringify({ order_id: deposit.id, payment_id: paymentFor(deposit.id).payment_id });
  const signature = createHmac("sha512", "isolated-ipn-secret").update(body).digest("hex");
  context.failLookup = true;
  expect((await ipn(new Request("https://marketplace.example.test/api/payments/nowpayments/ipn", {
    method: "POST", body, headers: { "x-nowpayments-sig": signature },
  }))).status).toBe(503);
  expect(await creditCount(deposit.id)).toHaveLength(0);
  context.failLookup = false;
  expect((await recoverDeposits()).failed).toBe(0);
  expect(await creditCount(deposit.id)).toHaveLength(1);
});

it("recovers missed callbacks through maintenance", async () => {
  const buyer = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  finish(paymentFor(deposit.id));
  await db.update(schema.financialDeposits).set({ nextCheckAt: new Date(0) }).where(eq(schema.financialDeposits.commandId, deposit.id));
  expect((await recoverDeposits()).failed).toBe(0);
  expect(await creditCount(deposit.id)).toHaveLength(1);
});

it("never resubmits an uncertain provider creation and recovers its original identity", async () => {
  const buyer = await member();
  const request = { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" };
  const count = context.creations;
  context.failCreation = true;
  await expect(createDeposit(buyer, request)).rejects.toThrow("transport");
  const retry = await createDeposit(buyer, request);
  expect(context.creations).toBe(count + 1);
  await expect(createDeposit(buyer, { ...request, requestId: randomUUID() })).rejects.toThrow("earlier deposit request");
  context.failCreation = false;
  await recoverDepositNotification({ order_id: retry.id, payment_id: paymentFor(retry.id).payment_id });
  const [command] = await db.select().from(schema.financialCommands).where(eq(schema.financialCommands.id, retry.id));
  expect(command.state).toBe("identified");
  expect(context.creations).toBe(count + 1);
});

it.each(["wrong_asset", "wrong_payin_finished", "wrong_asset_confirmed", "usdc_settlement", "usdt_wrong_network", "partial", "overpaid", "invalid_net", "unbacked"])("does not credit %s evidence", async condition => {
  const buyer = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  const payment = paymentFor(deposit.id); finish(payment);
  if (condition === "wrong_asset") payment.outcome_currency = "other";
  if (condition === "wrong_payin_finished") payment.pay_currency = "btc";
  if (condition === "wrong_asset_confirmed") payment.payment_status = "wrong_asset_confirmed";
  if (condition === "usdc_settlement") payment.outcome_currency = "usdcbase";
  if (condition === "usdt_wrong_network") payment.outcome_currency = "usdttrc20";
  if (condition === "partial") payment.actually_paid = "19";
  if (condition === "overpaid") payment.actually_paid = "21";
  if (condition === "invalid_net") payment.outcome_amount = "19.1234567";
  if (condition === "unbacked") context.backingAtoms = 0n;
  await observeDeposit(deposit.id, buyer);
  expect(await creditCount(deposit.id)).toHaveLength(0);
  expect(await balance(buyer, "available")).toBe(0n);
});

it("rejects an invalid Ethereum address during recovery without creating another payment", async () => {
  const buyer = await member();
  const request = { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" };
  context.failCreation = true;
  await expect(createDeposit(buyer, request)).rejects.toThrow("transport");
  const original = await createDeposit(buyer, request);
  const payment = { ...paymentFor(original.id), pay_address: "not-an-ethereum-address" };
  const creations = context.creations;
  await expect(db.transaction(tx => persistDepositInstructions(tx, original.id, buyer, payment))).rejects.toThrow("reconciliation review");
  expect(context.creations).toBe(creations);
  expect(await creditCount(original.id)).toHaveLength(0);
});

it("does not display or charge a historical USDC policy quote as USDT", async () => {
  const buyer = await member(); const seller = await member(); await fund(buyer);
  const item = await product(seller);
  const [checkout] = await db.insert(schema.financialCheckouts).values({ buyerId: buyer, requestId: randomUUID(),
    requestDigest: "a".repeat(64), fromCart: false, expiresAt: new Date(Date.now() + 300_000) }).returning();
  if (!checkout) throw new Error("Fixture checkout unavailable.");
  await db.insert(schema.financialPurchaseQuotes).values({ checkoutId: checkout.id, buyerId: buyer, sellerId: seller,
    revisionId: item.revision.id, amountAtoms: 20_000_000n, policyVersion: "2026-09-21-usdc-base-v2",
    evidenceReference: "historical-usdc-rate", expiresAt: checkout.expiresAt });
  await expect(checkoutView(buyer, checkout.id)).rejects.toThrow("currency policy changed");
  await expect(db.transaction(tx => commitCheckout(tx, buyer, checkout.id, "20"))).rejects.toThrow("currency policy changed");
  expect(await balance(buyer, "available")).toBe(100_000_000n);
  expect(await balance(seller, "pending")).toBe(0n);
});

it("keeps partial payments in review even after a later finished response", async () => {
  const buyer = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  const payment = paymentFor(deposit.id); finish(payment); payment.actually_paid = "19";
  await observeDeposit(deposit.id, buyer);
  finish(payment);
  await observeDeposit(deposit.id, buyer);
  expect(await creditCount(deposit.id)).toHaveLength(0);
  const [record] = await db.select().from(schema.financialDeposits).where(eq(schema.financialDeposits.commandId, deposit.id));
  expect(record.status).toBe("partial_payment");
});

it("rejects reuse of a settlement transfer and freezes conflicting evidence after credit", async () => {
  const buyer = await member();
  const a = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  const paid = paymentFor(a.id); finish(paid); await observeDeposit(a.id, buyer);
  const b = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "usdterc20" });
  const duplicate = paymentFor(b.id); finish(duplicate); duplicate.payin_hash = paid.payin_hash;
  await observeDeposit(b.id, buyer);
  expect(await creditCount(b.id)).toHaveLength(0);
  paid.outcome_amount = "19.6";
  await observeDeposit(a.id, buyer);
  expect(await balance(buyer, "available")).toBe(19_700_000n);
  expect(await creditCount(a.id)).toHaveLength(1);
  expect(await db.select().from(schema.financialFreezes).where(eq(schema.financialFreezes.memberId, buyer))).toHaveLength(1);
});

it("commits multi-seller charges, orders and selected cart changes atomically, with safe retries", async () => {
  const buyer = await member(); const sellerA = await member(); const sellerB = await member();
  await fund(buyer);
  const a = await product(sellerA); const b = await product(sellerB); const extra = await product(sellerA);
  await db.insert(schema.carts).values({ userId: buyer });
  await db.insert(schema.cartItems).values([a, b, extra].map(item => ({ userId: buyer, listingId: item.listing.id, addedPriceCents: item.listing.priceCents })));
  const request = { requestId: randomUUID(), listingIds: [a.listing.id, b.listing.id], fromCart: true };
  const quote = await issueCheckout(buyer, request);
  if (!quote) throw new Error("Fixture quote unavailable.");
  const purchase = () => db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total));
  const orders = await purchase();
  const first = orders[0];
  if (!first) throw new Error("Fixture checkout did not commit.");
  expect(await db.transaction(tx => settleStandardOrder(tx, first.id))).toBeNull();
  const retry = await purchase();
  expect(retry.map(order => order.id).sort()).toEqual(orders.map(order => order.id).sort());
  expect(await balance(buyer, "available")).toBe(60_200_000n);
  expect(await balance(sellerA, "pending") + await balance(sellerB, "pending")).toBe(39_800_000n);
  expect((await db.select().from(schema.cartItems).where(eq(schema.cartItems.userId, buyer))).map(item => item.listingId)).toEqual([extra.listing.id]);
});

it("connects a BTC deposit to an internal purchase and protected seller fulfillment", async () => {
  const buyer = await member(); const seller = await member();
  const deposit = await createDeposit(buyer, { requestId: randomUUID(), priceUsd: "20", currency: "btc" });
  finish(paymentFor(deposit.id)); await observeDeposit(deposit.id, buyer);
  const item = await product(seller, "manual", 1000);
  const quote = await issueCheckout(buyer, { requestId: randomUUID(), listingIds: [item.listing.id], fromCart: false });
  if (!quote) throw new Error("Fixture quote unavailable.");
  expect(quote.total).toBe("9.95");
  const [order] = await db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total));
  if (!order) throw new Error("Fixture order unavailable.");
  await db.transaction(tx => fulfillOrder(tx, seller, order.id, "Purchased private result"));
  context.ownerId = buyer;
  const response = await delivery(new Request(`https://marketplace.example.test/api/orders/${order.id}/delivery`), { params: Promise.resolve({ orderId: order.id }) });
  expect(await response.text()).toBe("Purchased private result");
  expect(await balance(buyer, "available")).toBe(9_750_000n);
  expect(await balance(seller, "pending")).toBe(9_950_000n);
  expect(await db.transaction(tx => settleStandardOrder(tx, order.id))).toBeNull();
});

it("rolls back every checkout line if a selected listing changed", async () => {
  const buyer = await member(); const seller = await member(); await fund(buyer);
  const a = await product(seller); const b = await product(seller);
  const quote = await issueCheckout(buyer, { requestId: randomUUID(), listingIds: [a.listing.id, b.listing.id], fromCart: false });
  if (!quote) throw new Error("Fixture quote unavailable.");
  await db.update(schema.listings).set({ available: false }).where(eq(schema.listings.id, b.listing.id));
  await expect(db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total))).rejects.toThrow("unavailable");
  expect(await balance(buyer, "available")).toBe(100_000_000n);
  expect(await balance(seller, "pending")).toBe(0n);
  expect((await db.select().from(schema.financialOrders).innerJoin(schema.financialPurchaseQuotes, eq(schema.financialPurchaseQuotes.id, schema.financialOrders.quoteId))
    .where(eq(schema.financialPurchaseQuotes.checkoutId, quote.id)))).toHaveLength(0);
});

it("blocks overspending and mismatched consent without a partial order", async () => {
  const buyer = await member(); const seller = await member(); await fund(buyer, 1_000_000n);
  const item = await product(seller);
  const quote = await issueCheckout(buyer, { requestId: randomUUID(), listingIds: [item.listing.id], fromCart: false });
  if (!quote) throw new Error("Fixture quote unavailable.");
  await expect(db.transaction(tx => commitCheckout(tx, buyer, quote.id, "1"))).rejects.toThrow("confirmed total");
  await expect(db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total))).rejects.toThrow("Insufficient");
  expect(await balance(buyer, "available")).toBe(1_000_000n);
});

it("blocks a purchase when live backing no longer covers the committed liabilities", async () => {
  const buyer = await member(); const seller = await member(); await fund(buyer);
  const item = await product(seller);
  const quote = await issueCheckout(buyer, { requestId: randomUUID(), listingIds: [item.listing.id], fromCart: false });
  if (!quote) throw new Error("Fixture quote unavailable.");
  context.backingAtoms = 0n;
  await expect(db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total))).rejects.toThrow("settlement backing");
  expect(await balance(buyer, "available")).toBe(100_000_000n);
  expect(await balance(seller, "pending")).toBe(0n);
});

it("protects manual delivery by committed buyer ownership and financial freeze", async () => {
  const buyer = await member(); const seller = await member(); const stranger = await member(); await fund(buyer);
  const item = await product(seller);
  const quote = await issueCheckout(buyer, { requestId: randomUUID(), listingIds: [item.listing.id], fromCart: false });
  if (!quote) throw new Error("Fixture quote unavailable.");
  const [order] = await db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total));
  if (!order) throw new Error("Fixture order unavailable.");
  await expect(db.transaction(tx => fulfillOrder(tx, stranger, order.id, "private receipt"))).rejects.toThrow("unavailable");
  await db.transaction(tx => fulfillOrder(tx, seller, order.id, "private receipt"));
  await db.transaction(tx => fulfillOrder(tx, seller, order.id, "private receipt"));
  await expect(db.transaction(tx => fulfillOrder(tx, seller, order.id, "different receipt"))).rejects.toThrow("already");
  context.ownerId = stranger;
  expect(await buyerOrder(order.id)).toBeNull();
  const request = new Request(`https://marketplace.example.test/api/orders/${order.id}/delivery`);
  expect((await delivery(request, { params: Promise.resolve({ orderId: order.id }) })).status).toBe(404);
  context.ownerId = buyer;
  expect(await (await delivery(request, { params: Promise.resolve({ orderId: order.id }) })).text()).toBe("private receipt");
  await db.insert(schema.financialFreezes).values({ memberId: buyer, reason: "isolated-incident" });
  expect((await delivery(request, { params: Promise.resolve({ orderId: order.id }) })).status).toBe(404);
});

it("releases mature seller proceeds once through maintenance and preserves the 24-hour hold", async () => {
  const buyer = await member(); const seller = await member(); await fund(buyer);
  const { revision } = await product(seller);
  const [quote] = await db.insert(schema.financialPurchaseQuotes).values({ buyerId: buyer, sellerId: seller, revisionId: revision.id,
    amountAtoms: 10_000_000n, policyVersion: financialPolicy.version, evidenceReference: "aged-fixture", expiresAt: new Date(Date.now() + 300000) }).returning();
  if (!quote) throw new Error("Fixture quote unavailable.");
  const order = await db.transaction(async tx => {
    await lockFinanceMembers(tx, [buyer, seller]); const accounts = await lockFinanceAccounts(tx, [buyer, seller]);
    const [journal] = await tx.insert(schema.financialJournals).values({ reference: `purchase:${quote.id}`, kind: "purchase", actorId: buyer,
      evidenceReference: "aged-fixture", debitAccountId: accounts.member(buyer, "available"), creditAccountId: accounts.member(seller, "pending"),
      amountAtoms: quote.amountAtoms, createdAt: new Date(Date.now() - 25 * 3600000) }).returning();
    if (!journal) throw new Error("Fixture journal unavailable.");
    const [order] = await tx.insert(schema.financialOrders).values({ quoteId: quote.id, paymentJournalId: journal.id,
      status: "paid", holdUntil: new Date(Date.now() - 3600000) }).returning();
    if (!order) throw new Error("Fixture order unavailable.");
    return order;
  });
  expect((await settleSellerHolds()).failed).toBe(0);
  await db.transaction(tx => settleStandardOrder(tx, order.id));
  expect(await balance(seller, "available")).toBe(10_000_000n);
  expect(await balance(seller, "pending")).toBe(0n);
  expect(await db.select().from(schema.financialJournals).where(eq(schema.financialJournals.reference, `settlement:${order.id}`))).toHaveLength(1);
});

it("grants a file entitlement only for the purchased revision's exact approved file", async () => {
  const buyer = await member(); const seller = await member(); const stranger = await member(); await fund(buyer);
  const item = await product(seller, "file");
  const [file] = await db.insert(schema.attachments).values({ ownerId: seller, purpose: "listing_delivery", resourceId: item.listing.id,
    storageKey: randomUUID(), mediaType: "text/plain", byteSize: 10, checksum: "c".repeat(64), state: "ready", scanStatus: "clean" }).returning();
  if (!file) throw new Error("Fixture file unavailable.");
  // Issue a new immutable revision rather than editing the old purchased data.
  await db.update(schema.listings).set({ version: 2 }).where(eq(schema.listings.id, item.listing.id));
  await db.insert(schema.listingRevisions).values({ listingId: item.listing.id, version: 2, title: item.listing.title, description: item.listing.description,
    kind: item.listing.kind, priceCents: item.listing.priceCents, fulfillmentMode: "file", deliveryTerms: item.listing.deliveryTerms, protectedFileId: file.id });
  const quote = await issueCheckout(buyer, { requestId: randomUUID(), listingIds: [item.listing.id], fromCart: false });
  if (!quote) throw new Error("Fixture quote unavailable.");
  await db.transaction(tx => commitCheckout(tx, buyer, quote.id, quote.total));
  context.ownerId = stranger; expect(await buyerFileEntitlement(file.id, item.listing.id)).toBe(false);
  context.ownerId = buyer; expect(await buyerFileEntitlement(file.id, item.listing.id)).toBe(true);
  expect(await buyerFileEntitlement(randomUUID(), item.listing.id)).toBe(false);
  await db.insert(schema.financialFreezes).values({ memberId: seller, reason: "isolated-freeze" });
  expect(await buyerFileEntitlement(file.id, item.listing.id)).toBe(false);
  expect(await reconcileLedger()).toMatchObject({ balanced: true, issues: [] });
});
