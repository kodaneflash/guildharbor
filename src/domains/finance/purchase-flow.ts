import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { attachments, financialOrders, financialPurchaseQuotes, listingRevisions, listings, sellerProfiles } from "@/db/schema";
import type { FinanceTransaction } from "./database";
import { financialEvent, financialNow, lockFinanceAccounts, lockFinanceMembers } from "./flow-support";
import { postJournal } from "./ledger";
import { financialPolicy } from "./policy";

export class PurchaseUnavailable extends Error {}

/** Internal transaction service. The authenticated entry point must keep the
 * production execution gate closed until financial acceptance is complete.
 * Quotes are server-issued immutable records, never browser-supplied prices.
 */
export async function commitStandardPurchase(tx: FinanceTransaction, buyerId: string, quoteId: string) {
  z.uuid().parse(quoteId);
  const [quote] = await tx.select().from(financialPurchaseQuotes).where(and(eq(financialPurchaseQuotes.id, quoteId), eq(financialPurchaseQuotes.buyerId, buyerId)));
  if (!quote) throw new PurchaseUnavailable("Purchase quote unavailable.");
  await lockFinanceMembers(tx, [buyerId, quote.sellerId]);
  const [existing] = await tx.select().from(financialOrders).where(eq(financialOrders.quoteId, quoteId));
  if (existing) return existing;
  const now = await financialNow(tx);
  if (quote.expiresAt <= now || quote.policyVersion !== financialPolicy.version) throw new PurchaseUnavailable("Purchase quote expired. Review a new quote.");
  const [revision] = await tx.select().from(listingRevisions).where(eq(listingRevisions.id, quote.revisionId)).for("share");
  if (!revision) throw new Error("Listing revision unavailable.");
  const [seller] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, quote.sellerId)).for("share");
  const [listing] = await tx.select().from(listings).where(eq(listings.id, revision.listingId)).for("share");
  if (!seller || seller.status !== "active" || !listing || listing.sellerId !== quote.sellerId ||
    listing.version !== revision.version || listing.priceCents !== revision.priceCents || listing.status !== "published" || !listing.available) {
    throw new PurchaseUnavailable("Listing changed or is unavailable. Review a new quote.");
  }
  if (revision.fulfillmentMode === "text" && !revision.protectedText) throw new PurchaseUnavailable("Protected delivery unavailable.");
  if (revision.fulfillmentMode === "file") {
    const [file] = revision.protectedFileId ? await tx.select().from(attachments).where(and(
      eq(attachments.id, revision.protectedFileId), eq(attachments.ownerId, quote.sellerId),
      eq(attachments.resourceId, listing.id), eq(attachments.purpose, "listing_delivery"),
      eq(attachments.state, "ready"), eq(attachments.scanStatus, "clean"),
    )).for("share") : [];
    if (!file) throw new PurchaseUnavailable("Protected delivery unavailable.");
  }
  const accounts = await lockFinanceAccounts(tx, [buyerId, quote.sellerId]);
  const journal = await postJournal(tx, {
    reference: `purchase:${quote.id}`, debitAccountId: accounts.member(buyerId, "available"),
    creditAccountId: accounts.member(quote.sellerId, "pending"), amountAtoms: quote.amountAtoms,
    kind: "purchase", actorId: buyerId, evidenceReference: quote.evidenceReference,
  });
  const [order] = await tx.insert(financialOrders).values({
    quoteId: quote.id, paymentJournalId: journal.id,
    status: revision.fulfillmentMode === "manual" ? "paid" : "completed",
    holdUntil: new Date(now.getTime() + financialPolicy.sellerWithdrawalHoldMs),
  }).returning();
  if (!order) throw new Error("Order was not committed.");
  for (const memberId of [buyerId, quote.sellerId]) await financialEvent(tx, {
    memberId, actorId: buyerId, eventKey: `purchase:${order.id}:${memberId}`, kind: "purchase", resourceId: order.id,
    message: memberId === buyerId ? "Purchase payment committed. Your order is available." : "Purchase proceeds received; the 24-hour seller hold is active. External cash-out is unavailable.",
  });
  return order;
}

/** Mature each order once; disputed/refunded proceeds are not released. */
export async function settleStandardOrder(tx: FinanceTransaction, orderId: string) {
  z.uuid().parse(orderId);
  const [initial] = await tx.select({ order: financialOrders, quote: financialPurchaseQuotes }).from(financialOrders)
    .innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId)).where(eq(financialOrders.id, orderId));
  if (!initial) throw new Error("Order unavailable.");
  await lockFinanceMembers(tx, [initial.quote.sellerId]);
  const [order] = await tx.select().from(financialOrders).where(eq(financialOrders.id, orderId)).for("update");
  if (!order) throw new Error("Order unavailable.");
  if (order.settledJournalId) return order;
  const now = await financialNow(tx);
  if (!["paid", "completed"].includes(order.status) || order.refundJournalId || order.holdUntil > now) return null;
  const accounts = await lockFinanceAccounts(tx, [initial.quote.sellerId]);
  const journal = await postJournal(tx, {
    reference: `settlement:${orderId}`, debitAccountId: accounts.member(initial.quote.sellerId, "pending"),
    creditAccountId: accounts.member(initial.quote.sellerId, "available"), amountAtoms: initial.quote.amountAtoms,
    kind: "settlement", actorId: initial.quote.sellerId, evidenceReference: order.paymentJournalId,
  });
  const [settled] = await tx.update(financialOrders).set({ settledJournalId: journal.id, updatedAt: now }).where(eq(financialOrders.id, orderId)).returning();
  await financialEvent(tx, { memberId: initial.quote.sellerId, actorId: initial.quote.sellerId, eventKey: `settlement:${orderId}`, kind: "settlement", resourceId: orderId, message: "The 24-hour seller hold has ended; proceeds are available for internal purchases. External cash-out is unavailable." });
  return settled;
}
