import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull, lte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { financialFreezes, financialFulfillments, financialOrders, financialPurchaseQuotes, listingRevisions, sellerProfiles, users } from "@/db/schema";
import { encryptDeliverable } from "@/domains/commerce/protected-text";
import { communityMemberFilter } from "@/lib/community-access";
import { requireMember } from "@/lib/session";
import type { FinanceTransaction } from "./database";
import { financialServicingEnabled } from "./gate";
import { financialEvent, financialNow, lockFinanceMembers } from "./flow-support";
import { settleStandardOrder } from "./purchase-flow";

export class FulfillmentUnavailable extends Error {}
export const fulfillmentSchema = z.object({ content: z.string().trim().min(1).max(100000) }).strict();

export async function sellerOrders() {
  const access = await requireMember();
  if (!financialServicingEnabled) return [];
  return createReadDatabase().select({ id: financialOrders.id, status: financialOrders.status,
    title: listingRevisions.title, fulfillmentMode: listingRevisions.fulfillmentMode, terms: listingRevisions.deliveryTerms,
    amountAtoms: financialPurchaseQuotes.amountAtoms, buyerUsername: users.username,
    holdUntil: financialOrders.holdUntil, settled: financialOrders.settledJournalId, fulfilledAt: financialFulfillments.createdAt,
  }).from(financialOrders).innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId))
    .innerJoin(listingRevisions, eq(listingRevisions.id, financialPurchaseQuotes.revisionId))
    .innerJoin(users, eq(users.id, financialPurchaseQuotes.buyerId))
    .leftJoin(financialFulfillments, eq(financialFulfillments.orderId, financialOrders.id))
    .where(eq(financialPurchaseQuotes.sellerId, access.user.id)).orderBy(desc(financialOrders.createdAt)).limit(100);
}

/** The paid order is the retry identity. The first fulfillment is immutable. */
export async function fulfillOrder(tx: FinanceTransaction, sellerId: string, orderId: string, content: string) {
  const data = fulfillmentSchema.parse({ content });
  const [initial] = await tx.select({ quote: financialPurchaseQuotes, revision: listingRevisions }).from(financialOrders)
    .innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId))
    .innerJoin(listingRevisions, eq(listingRevisions.id, financialPurchaseQuotes.revisionId))
    .where(and(eq(financialOrders.id, z.uuid().parse(orderId)), eq(financialPurchaseQuotes.sellerId, sellerId)));
  if (!initial || initial.revision.fulfillmentMode !== "manual") throw new FulfillmentUnavailable("Manual order unavailable.");
  await lockFinanceMembers(tx, [sellerId, initial.quote.buyerId]);
  const [seller] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, sellerId)).for("share");
  if (seller?.status !== "active") throw new FulfillmentUnavailable("Seller account is unavailable.");
  const [order] = await tx.select().from(financialOrders).where(eq(financialOrders.id, orderId)).for("update");
  if (!order || !["paid", "completed"].includes(order.status) || order.refundJournalId) throw new FulfillmentUnavailable("Order cannot be fulfilled.");
  const contentDigest = createHash("sha256").update(data.content).digest("hex");
  const [existing] = await tx.select().from(financialFulfillments).where(eq(financialFulfillments.orderId, orderId));
  if (existing) {
    if (existing.contentDigest !== contentDigest) throw new FulfillmentUnavailable("This order already has a committed fulfillment.");
    return;
  }
  const now = await financialNow(tx);
  await tx.insert(financialFulfillments).values({ orderId, sellerId, protectedText: encryptDeliverable(data.content), contentDigest });
  await tx.update(financialOrders).set({ status: "completed", updatedAt: now }).where(eq(financialOrders.id, orderId));
  for (const memberId of [sellerId, initial.quote.buyerId]) await financialEvent(tx, { memberId, actorId: sellerId,
    eventKey: `fulfillment:${orderId}:${memberId}`, kind: "fulfillment", resourceId: orderId, message: "Seller fulfillment is available on the protected order page." });
}

export async function submitFulfillment(sellerId: string, orderId: string, input: unknown) {
  if (!financialServicingEnabled) throw new FulfillmentUnavailable("Order fulfillment is not activated.");
  const data = fulfillmentSchema.parse(input);
  return withTransaction(tx => fulfillOrder(tx, sellerId, orderId, data.content));
}

export async function settleSellerHolds() {
  if (!financialServicingEnabled) return { enabled: false, settled: 0, failed: 0 };
  const due = await createReadDatabase().select({ id: financialOrders.id }).from(financialOrders)
    .innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId))
    .innerJoin(users, eq(users.id, financialPurchaseQuotes.sellerId))
    .where(and(communityMemberFilter(), sql`not exists (select 1 from ${financialFreezes} f where f.member_id = ${financialPurchaseQuotes.sellerId})`, isNull(financialOrders.settledJournalId), isNull(financialOrders.refundJournalId),
      inArray(financialOrders.status, ["paid", "completed"]), lte(financialOrders.holdUntil, sql`now()`)))
    .orderBy(financialOrders.holdUntil).limit(25);
  let settled = 0; let failed = 0;
  for (const order of due) {
    try { if (await withTransaction(tx => settleStandardOrder(tx, order.id))) settled++; }
    catch { failed++; console.error("finance.seller_hold.failed", { orderId: order.id }); }
  }
  return { enabled: true, settled, failed };
}
