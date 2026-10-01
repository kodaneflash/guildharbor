import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { cartItems, carts, financialCheckouts, financialOrders, financialPurchaseQuotes, listingRevisions, listings, sellerProfiles } from "@/db/schema";
import type { FinanceTransaction } from "./database";
import { retainEvidence } from "./commands";
import { nowPaymentsDepositConfig } from "./config";
import { approvedDepositAsset } from "./assets";
import { newPurchasesEnabled } from "./gate";
import { financialNow, lockFinanceAccounts, lockFinanceMembers } from "./flow-support";
import { accountBalance } from "./ledger";
import { formatUsdt, parseUsdt, positiveUsdt } from "./money";
import { estimateUsdPurchase } from "./purchase-estimate";
import { commitStandardPurchase } from "./purchase-flow";
import { readCustodyBacking } from "./deposit-provider";
import { financialPolicy } from "./policy";

export class CheckoutUnavailable extends Error {}
export const checkoutRequestSchema = z.object({ requestId: z.uuid(), listingIds: z.array(z.uuid()).min(1).max(100), fromCart: z.boolean() }).strict();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function checkoutView(buyerId: string, id: string) {
  const db = createReadDatabase();
  const [checkout] = await db.select().from(financialCheckouts).where(and(eq(financialCheckouts.id, id), eq(financialCheckouts.buyerId, buyerId)));
  if (!checkout) return null;
  const lines = await db.select({ id: financialPurchaseQuotes.id, amount: financialPurchaseQuotes.amountAtoms,
    policyVersion: financialPurchaseQuotes.policyVersion,
    title: listingRevisions.title, priceCents: listingRevisions.priceCents, terms: listingRevisions.deliveryTerms,
    fulfillment: listingRevisions.fulfillmentMode, orderId: financialOrders.id,
  }).from(financialPurchaseQuotes).innerJoin(listingRevisions, eq(listingRevisions.id, financialPurchaseQuotes.revisionId))
    .leftJoin(financialOrders, eq(financialOrders.quoteId, financialPurchaseQuotes.id))
    .where(eq(financialPurchaseQuotes.checkoutId, id)).orderBy(financialPurchaseQuotes.id);
  if (lines.some(line => line.policyVersion !== financialPolicy.version)) throw new CheckoutUnavailable("Checkout currency policy changed. Request a new quote.");
  return { id, expiresAt: checkout.expiresAt.toISOString(), total: formatUsdt(lines.reduce((sum, line) => sum + line.amount, 0n)),
    lines: lines.map(line => ({ ...line, amount: formatUsdt(line.amount) })), completed: lines.length > 0 && lines.every(line => line.orderId !== null) };
}

export async function issueCheckout(buyerId: string, untrusted: unknown) {
  if (!newPurchasesEnabled) throw new CheckoutUnavailable("Paid checkout is not activated.");
  const input = checkoutRequestSchema.parse(untrusted);
  const ids = [...new Set(input.listingIds)].sort();
  if (ids.length !== input.listingIds.length) throw new CheckoutUnavailable("Each listing may be selected once.");
  const requestDigest = digest(JSON.stringify({ listingIds: ids, fromCart: input.fromCart }));
  const db = createReadDatabase();
  const [existing] = await db.select().from(financialCheckouts).where(and(eq(financialCheckouts.buyerId, buyerId), eq(financialCheckouts.requestId, input.requestId)));
  if (existing) {
    if (existing.requestDigest !== requestDigest) throw new CheckoutUnavailable("This checkout request belongs to a different selection.");
    return checkoutView(buyerId, existing.id);
  }
  const selected = await db.select({ listing: listings, revision: listingRevisions }).from(listings)
    .innerJoin(listingRevisions, and(eq(listingRevisions.listingId, listings.id), eq(listingRevisions.version, listings.version)))
    .where(inArray(listings.id, ids)).orderBy(listings.id);
  if (selected.length !== ids.length || selected.some(row => row.listing.sellerId === buyerId || row.listing.status !== "published" || !row.listing.available)) {
    throw new CheckoutUnavailable("A selected product is unavailable. Review your selection.");
  }
  const config = nowPaymentsDepositConfig();
  approvedDepositAsset(config.ticker);
  const totalCents = selected.reduce((sum, row) => sum + BigInt(row.revision.priceCents), 0n);
  const estimate = await estimateUsdPurchase({ priceCents: totalCents, verifiedSettlementTicker: config.ticker, apiKey: config.apiKey });
  const totalAtoms = positiveUsdt(estimate.estimatedAmount);
  // One observed total rate; deterministic exact allocation preserves every atom.
  let allocated = 0n;
  const amounts = selected.map((row, index) => {
    const amount = index === selected.length - 1 ? totalAtoms - allocated : totalAtoms * BigInt(row.revision.priceCents) / totalCents;
    allocated += amount;
    if (amount <= 0n) throw new CheckoutUnavailable("This quote cannot represent every product in micro-USDT.");
    return amount;
  });
  const id = await withTransaction(async tx => {
    await lockFinanceMembers(tx, [buyerId, ...selected.map(row => row.listing.sellerId)]);
    const [retry] = await tx.select().from(financialCheckouts).where(and(eq(financialCheckouts.buyerId, buyerId), eq(financialCheckouts.requestId, input.requestId)));
    if (retry) {
      if (retry.requestDigest !== requestDigest) throw new CheckoutUnavailable("Checkout request changed.");
      return retry.id;
    }
    if (input.fromCart) {
      const cart = await tx.select().from(cartItems).where(and(eq(cartItems.userId, buyerId), inArray(cartItems.listingId, ids)));
      if (cart.length !== ids.length) throw new CheckoutUnavailable("Your selected cart items changed. Review your cart.");
    }
    const sellers = await tx.select().from(sellerProfiles).where(inArray(sellerProfiles.userId, selected.map(row => row.listing.sellerId))).for("share");
    if (sellers.some(seller => seller.status !== "active") || sellers.length !== new Set(selected.map(row => row.listing.sellerId)).size) {
      throw new CheckoutUnavailable("A seller is unavailable.");
    }
    const now = await financialNow(tx);
    const expiresAt = new Date(now.getTime() + 300_000);
    const [checkout] = await tx.insert(financialCheckouts).values({ buyerId, requestId: input.requestId, requestDigest, fromCart: input.fromCart, expiresAt }).returning();
    if (!checkout) throw new Error("Checkout was not issued.");
    const evidence = await retainEvidence(tx, { source: "lookup", digest: digest(estimate.evidenceBody), body: estimate.evidenceBody, keyHex: config.keyHex, keyVersion: config.keyVersion });
    await tx.insert(financialPurchaseQuotes).values(selected.map((row, index) => ({ checkoutId: checkout.id, buyerId, sellerId: row.listing.sellerId,
      revisionId: row.revision.id, amountAtoms: amounts[index], expiresAt, policyVersion: financialPolicy.version, evidenceReference: `rate:${evidence.id}` })));
    return checkout.id;
  });
  return checkoutView(buyerId, id);
}

/** All participants lock once, in canonical order, before any line is committed.
 * A failure rolls back journals, orders, notices and purchased cart removals. */
export async function commitCheckout(tx: FinanceTransaction, buyerId: string, id: string, confirmedTotal: string) {
  const [checkout] = await tx.select().from(financialCheckouts).where(and(eq(financialCheckouts.id, id), eq(financialCheckouts.buyerId, buyerId)));
  if (!checkout) throw new CheckoutUnavailable("Checkout unavailable.");
  const quotes = await tx.select().from(financialPurchaseQuotes).where(eq(financialPurchaseQuotes.checkoutId, id)).orderBy(financialPurchaseQuotes.id);
  if (!quotes.length || quotes.some(quote => quote.buyerId !== buyerId)) throw new CheckoutUnavailable("Checkout has no valid products.");
  if (quotes.some(quote => quote.policyVersion !== financialPolicy.version)) throw new CheckoutUnavailable("Checkout currency policy changed. Request a new quote.");
  if (parseUsdt(confirmedTotal) !== quotes.reduce((sum, quote) => sum + quote.amountAtoms, 0n)) {
    throw new CheckoutUnavailable("The confirmed total does not match this quote.");
  }
  await lockFinanceMembers(tx, [buyerId, ...quotes.map(quote => quote.sellerId)]);
  const orders = await tx.select().from(financialOrders).where(inArray(financialOrders.quoteId, quotes.map(quote => quote.id)));
  if (orders.length === quotes.length) return orders;
  if (orders.length) throw new Error("Checkout is partially committed; reconciliation required.");
  if (checkout.expiresAt <= await financialNow(tx)) throw new CheckoutUnavailable("Checkout expired. Request a new quote.");
  const accounts = await lockFinanceAccounts(tx, [buyerId, ...quotes.map(quote => quote.sellerId)]);
  const charge = quotes.reduce((sum, quote) => sum + quote.amountAtoms, 0n);
  if (await accountBalance(tx, accounts.member(buyerId, "available")) < charge) throw new CheckoutUnavailable("Insufficient available USDT. Top up your wallet or change your selection.");
  const config = nowPaymentsDepositConfig();
  const backing = await readCustodyBacking(config.apiKey, config.ticker);
  const book = -(await accountBalance(tx, accounts.system("backing")));
  if (book < 0n || backing.atoms < book) throw new CheckoutUnavailable("Purchases are paused because settlement backing requires reconciliation.");
  await retainEvidence(tx, { source: "lookup", digest: digest(backing.raw), body: backing.raw, keyHex: config.keyHex, keyVersion: config.keyVersion });
  const committed = [];
  for (const quote of quotes) committed.push(await commitStandardPurchase(tx, buyerId, quote.id));
  const revisions = await tx.select({ listingId: listingRevisions.listingId }).from(listingRevisions).where(inArray(listingRevisions.id, quotes.map(quote => quote.revisionId)));
  const removed = await tx.delete(cartItems).where(and(eq(cartItems.userId, buyerId), inArray(cartItems.listingId, revisions.map(row => row.listingId)))).returning();
  if (removed.length) await tx.update(carts).set({ version: sql`${carts.version} + 1`, updatedAt: new Date() }).where(eq(carts.userId, buyerId));
  return committed;
}

export async function purchaseCheckout(buyerId: string, id: string, confirmedTotal: string) {
  if (!newPurchasesEnabled) throw new CheckoutUnavailable("Paid checkout is not activated.");
  z.uuid().parse(id);
  return withTransaction(tx => commitCheckout(tx, buyerId, id, confirmedTotal));
}
