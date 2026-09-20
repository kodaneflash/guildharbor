import "server-only";
import { and, asc, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { attachments, cartItems, carts, domainAuditEvents, listingFavorites, listingRevisions, listings, marketplaceCategories, profiles, sellerProfiles, users } from "@/db/schema";
import { transactionActor } from "@/domains/authorization";
import { communityMemberFilter } from "@/lib/community-access";
import { requireMember } from "@/lib/session";
import { encryptDeliverable } from "./protected-text";
import { listingSchema, listingSlug, sellerPolicyVersion, sellerSchema } from "./validation";

export async function enrollSeller(input: unknown) {
  const access = await requireMember(); const data = sellerSchema.parse(input);
  await withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    const [current] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, access.user.id)).for("update");
    if (current && current.status !== "active") throw new Error("Seller account is not active. Contact support.");
    await tx.insert(sellerProfiles).values({ userId: access.user.id, name: data.name, description: data.description, policyVersion: sellerPolicyVersion, policyAcceptedAt: new Date() }).onConflictDoUpdate({ target: sellerProfiles.userId, set: { name: data.name, description: data.description, updatedAt: new Date() } });
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "seller", resourceId: access.user.id, action: current ? "seller.update" : "seller.enroll", reason: "Seller policy accepted", metadata: { policyVersion: sellerPolicyVersion } });
  });
}
export async function saveListing(input: unknown) {
  const access = await requireMember(); const data = listingSchema.parse(input);
  return withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    const [seller] = await tx.select().from(sellerProfiles).where(eq(sellerProfiles.userId, access.user.id)).for("share");
    if (!seller || seller.status !== "active") return { error: "Open an active seller profile before managing listings." };
    const [current] = data.id ? await tx.select().from(listings).where(and(eq(listings.id, data.id), eq(listings.sellerId, access.user.id))).for("update") : [];
    if (data.id && !current) throw new Error("FORBIDDEN");
    if (current && (current.version !== data.version || current.status === "removed")) return { error: "This listing changed or was removed. Reload before editing." };
    if (data.categoryId) {
      const [category] = await tx.select().from(marketplaceCategories).where(and(eq(marketplaceCategories.id, data.categoryId), isNull(marketplaceCategories.archivedAt))).for("share");
      if (!category) return { error: "Choose an active category or leave the listing uncategorized." };
    }
    const [previous] = current ? await tx.select().from(listingRevisions).where(and(eq(listingRevisions.listingId, current.id), eq(listingRevisions.version, current.version))) : [];
    const protectedText = data.fulfillmentMode === "text" ? (data.protectedText ? encryptDeliverable(data.protectedText) : previous?.protectedText ?? null) : null;
    if (data.status === "published" && data.fulfillmentMode === "text" && !protectedText) return { error: "Add protected text before publishing." };
    const protectedFileId = data.fulfillmentMode === "file" ? previous?.protectedFileId ?? null : null;
    if (data.status === "published" && data.fulfillmentMode === "file") {
      const [file] = protectedFileId ? await tx.select().from(attachments).where(and(eq(attachments.id, protectedFileId), eq(attachments.state, "ready"), eq(attachments.scanStatus, "clean"), eq(attachments.ownerId, access.user.id), eq(attachments.purpose, "listing_delivery"), eq(attachments.resourceId, current?.id ?? ""))).for("share") : [];
      if (!file) return { error: "A scanned, approved delivery file is required before publishing." };
    }
    const fields = { title: data.title, slug: listingSlug(data.title), description: data.description, categoryId: data.categoryId, kind: data.kind, fulfillmentMode: data.fulfillmentMode, deliveryTerms: data.deliveryTerms, priceCents: data.price, available: data.available, status: data.status, version: (current?.version ?? 0) + 1, updatedAt: new Date() };
    const [listing] = current ? await tx.update(listings).set(fields).where(eq(listings.id, current.id)).returning() : await tx.insert(listings).values({ ...fields, sellerId: access.user.id }).returning();
    await tx.insert(listingRevisions).values({ listingId: listing.id, version: listing.version, title: listing.title, description: listing.description, kind: listing.kind, priceCents: listing.priceCents, fulfillmentMode: listing.fulfillmentMode, deliveryTerms: listing.deliveryTerms, protectedText, protectedFileId });
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "listing", resourceId: listing.id, action: `listing.${listing.status}`, reason: "Seller saved listing revision", metadata: { version: listing.version } });
    return { id: listing.id, slug: listing.slug };
  });
}
export async function catalog(options: { query?: string; categoryId?: string; kind?: string; page?: number; sort?: string; sellerId?: string; favorites?: boolean } = {}) {
  const access = await requireMember();
  const database = createReadDatabase();
  const favoriteIds = options.favorites ? await database.select({ id: listingFavorites.listingId }).from(listingFavorites).where(eq(listingFavorites.userId, access.user.id)) : null;
  if (favoriteIds && !favoriteIds.length) return [];
  return database.select({ listing: listings, sellerName: sellerProfiles.name, username: users.username,
    sellerAvatar: profiles.avatarUrl,
    imageId: sql<string | null>`(select ${attachments.id} from ${attachments}
      where ${attachments.resourceId} = ${listings.id}::text
        and ${attachments.ownerId} = ${listings.sellerId}
        and ${attachments.purpose} = 'listing_media'
        and ${attachments.state} = 'ready' and ${attachments.scanStatus} = 'clean'
        and ${attachments.mediaType} = 'image/webp'
      order by ${attachments.createdAt}, ${attachments.id} limit 1)`,
  }).from(listings).innerJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId)).innerJoin(users, eq(users.id, sellerProfiles.userId)).leftJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(listings.status, "published"), eq(sellerProfiles.status, "active"), communityMemberFilter(), options.query ? or(ilike(listings.title, `%${options.query.slice(0, 200)}%`), ilike(listings.description, `%${options.query.slice(0, 200)}%`)) : undefined, options.categoryId ? eq(listings.categoryId, z.uuid().parse(options.categoryId)) : undefined, ["digital", "service"].includes(options.kind ?? "") ? eq(listings.kind, options.kind ?? "") : undefined, options.sellerId ? eq(listings.sellerId, options.sellerId) : undefined, favoriteIds ? inArray(listings.id, favoriteIds.map(item => item.id)) : undefined)).orderBy(options.sort === "price" ? asc(listings.priceCents) : desc(listings.createdAt), desc(listings.id)).limit(24).offset((Math.max(1, options.page ?? 1) - 1) * 24);
}
export async function listingDetail(id: string) {
  await requireMember(); if (!z.uuid().safeParse(id).success) return null;
  const [row] = await createReadDatabase().select({ listing: listings, sellerName: sellerProfiles.name, username: users.username }).from(listings).innerJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId)).innerJoin(users, eq(users.id, listings.sellerId)).where(and(eq(listings.id, id), eq(listings.status, "published"), eq(sellerProfiles.status, "active"), communityMemberFilter()));
  return row ?? null;
}
export async function activeCategories() { await requireMember(); return createReadDatabase().select().from(marketplaceCategories).where(isNull(marketplaceCategories.archivedAt)).orderBy(asc(marketplaceCategories.name)); }
export async function currentSellerProfile() {
  const access = await requireMember();
  const [seller] = await createReadDatabase().select().from(sellerProfiles).where(eq(sellerProfiles.userId, access.user.id));
  return seller ?? null;
}
export async function sellerWorkspaceHref() {
  return await currentSellerProfile() ? "/seller" : "/seller/onboarding";
}
export async function modifySelection(id: string, operation: "cart.add" | "cart.remove" | "favorite.add" | "favorite.remove") {
  const access = await requireMember(); z.uuid().parse(id);
  return withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    if (operation === "cart.remove") {
      const removed = await tx.delete(cartItems).where(and(eq(cartItems.userId, access.user.id), eq(cartItems.listingId, id))).returning({ id: cartItems.listingId });
      if (removed.length) await tx.update(carts).set({ version: sql`${carts.version} + 1`, updatedAt: new Date() }).where(eq(carts.userId, access.user.id));
      return;
    }
    if (operation === "favorite.remove") { await tx.delete(listingFavorites).where(and(eq(listingFavorites.userId, access.user.id), eq(listingFavorites.listingId, id))); return; }
    const [row] = await tx.select({ listing: listings }).from(listings).innerJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId)).innerJoin(users, eq(users.id, listings.sellerId)).where(and(eq(listings.id, id), eq(listings.status, "published"), eq(listings.available, true), ne(listings.sellerId, access.user.id), eq(sellerProfiles.status, "active"), communityMemberFilter())).for("share");
    if (!row) return { error: "This listing is unavailable or belongs to you. Refresh to see its current status." };
    if (operation === "favorite.add") { await tx.insert(listingFavorites).values({ userId: access.user.id, listingId: id }).onConflictDoNothing(); return; }
    await tx.insert(carts).values({ userId: access.user.id }).onConflictDoNothing();
    await tx.select().from(carts).where(eq(carts.userId, access.user.id)).for("update");
    const existingItems = await tx.select({ id: cartItems.listingId }).from(cartItems).where(eq(cartItems.userId, access.user.id));
    if (existingItems.some(item => item.id === id)) return;
    if (existingItems.length >= 100) return { error: "Your cart holds up to 100 distinct listings. Remove an item first." };
    await tx.insert(cartItems).values({ userId: access.user.id, listingId: id, addedPriceCents: row.listing.priceCents });
    await tx.update(carts).set({ version: sql`${carts.version} + 1`, updatedAt: new Date() }).where(eq(carts.userId, access.user.id));
  });
}
export async function checkoutReview(selectedId?: string, selectedCartIds?: string[]) {
  const access = await requireMember(); const database = createReadDatabase();
  if (selectedCartIds) z.array(z.uuid()).max(100).parse(selectedCartIds);
  const allItems = selectedId ? [{ listingId: z.uuid().parse(selectedId), addedPriceCents: null }] : await database.select({ listingId: cartItems.listingId, addedPriceCents: cartItems.addedPriceCents }).from(cartItems).where(eq(cartItems.userId, access.user.id)).orderBy(asc(cartItems.createdAt));
  const items = selectedCartIds ? allItems.filter(item => selectedCartIds.includes(item.listingId)) : allItems;
  const visible = items.length ? await database.select({ listing: listings, sellerName: sellerProfiles.name, username: users.username, eligible: sql<boolean>`(${communityMemberFilter()}) and ${sellerProfiles.status} = 'active'` }).from(listings).innerJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId)).innerJoin(users, eq(users.id, listings.sellerId)).where(inArray(listings.id, items.map(item => item.listingId))) : [];
  return items.map(item => {
    const row = visible.find(row => row.listing.id === item.listingId);
    const available = Boolean(row && row.eligible && row.listing.status === "published" && row.listing.available && row.listing.sellerId !== access.user.id);
    // Unpublished metadata stays private even when a previously saved cart reference remains.
    if (!row || !row.eligible || row.listing.status !== "published") return { id: item.listingId, available: false, changed: false, listing: null, sellerName: null, username: null };
    return { id: item.listingId, available, changed: item.addedPriceCents !== null && item.addedPriceCents !== row.listing.priceCents, listing: row.listing, sellerName: row.sellerName, username: row.username };
  });
}
