import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { financialOrders, financialPurchaseQuotes, listingRevisions, financialFreezes, financialFulfillments, users } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { financialServicingEnabled } from "./gate";

export async function buyerOrders() {
  const access = await requireMember();
  if (!financialServicingEnabled) return [];
  return createReadDatabase().select({ id: financialOrders.id, status: financialOrders.status,
    createdAt: financialOrders.createdAt, title: listingRevisions.title, amountAtoms: financialPurchaseQuotes.amountAtoms,
  }).from(financialOrders)
    .innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId))
    .innerJoin(listingRevisions, eq(listingRevisions.id, financialPurchaseQuotes.revisionId))
    .where(eq(financialPurchaseQuotes.buyerId, access.user.id))
    .orderBy(desc(financialOrders.createdAt), desc(financialOrders.id)).limit(100);
}

/** Paid order itself is the entitlement; no redundant entitlement cache. Never
 * authorize every file on a listing: only the purchased revision's exact file. */
export async function buyerOrder(orderId: string) {
  const access = await requireMember();
  if (!financialServicingEnabled || !z.uuid().safeParse(orderId).success) return null;
  const [row] = await createReadDatabase().select({ order: financialOrders, revision: listingRevisions,
    amountAtoms: financialPurchaseQuotes.amountAtoms, sellerId: financialPurchaseQuotes.sellerId,
    sellerUsername: users.username, fulfillment: financialFulfillments.protectedText,
    deliveryAllowed: sql<boolean>`not exists (select 1 from ${financialFreezes} f where f.member_id in (${financialPurchaseQuotes.buyerId}, ${financialPurchaseQuotes.sellerId}))`,
  }).from(financialOrders)
    .innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId))
    .innerJoin(listingRevisions, eq(listingRevisions.id, financialPurchaseQuotes.revisionId))
    .innerJoin(users, eq(users.id, financialPurchaseQuotes.sellerId))
    .leftJoin(financialFulfillments, eq(financialFulfillments.orderId, financialOrders.id))
    .where(and(eq(financialOrders.id, orderId), eq(financialPurchaseQuotes.buyerId, access.user.id)));
  return row ?? null;
}

export async function buyerFileEntitlement(fileId: string, listingId: string) {
  const access = await requireMember();
  if (!financialServicingEnabled) return false;
  const [row] = await createReadDatabase().select({ id: financialOrders.id }).from(financialOrders)
    .innerJoin(financialPurchaseQuotes, eq(financialPurchaseQuotes.id, financialOrders.quoteId))
    .innerJoin(listingRevisions, eq(listingRevisions.id, financialPurchaseQuotes.revisionId))
    .where(and(eq(financialPurchaseQuotes.buyerId, access.user.id), eq(listingRevisions.listingId, listingId),
      eq(listingRevisions.protectedFileId, fileId), eq(listingRevisions.fulfillmentMode, "file"),
      inArray(financialOrders.status, ["paid", "completed"]), isNull(financialOrders.refundJournalId),
      sql`not exists (select 1 from ${financialFreezes} f where f.member_id in (${financialPurchaseQuotes.buyerId}, ${financialPurchaseQuotes.sellerId}))`)).limit(1);
  return Boolean(row);
}
