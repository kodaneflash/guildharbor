"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction } from "@/db/transaction";
import { attachments, domainAuditEvents, listings, sellerProfiles } from "@/db/schema";
import { transactionActor } from "@/domains/authorization";
import { requireMember } from "@/lib/session";
export async function removeListingImage(form: FormData) {
  const id = z.uuid().parse(form.get("id"));
  const listingId = z.uuid().parse(form.get("listingId"));
  const access = await requireMember();
  await withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    const [seller] = await tx.select().from(sellerProfiles).where(and(eq(sellerProfiles.userId, access.user.id), eq(sellerProfiles.status, "active"))).for("share");
    const [listing] = await tx.select().from(listings).where(and(eq(listings.id, listingId), eq(listings.sellerId, access.user.id))).for("update");
    const [file] = await tx.select().from(attachments).where(and(eq(attachments.id, id), eq(attachments.ownerId, access.user.id), eq(attachments.resourceId, listingId), eq(attachments.purpose, "listing_media"))).for("update");
    if (!file || !listing || listing.status === "removed" || !seller) throw new Error("FORBIDDEN");
    if (file.state !== "ready") return;
    await tx.update(attachments).set({ state: "rejected", updatedAt: new Date() }).where(eq(attachments.id, id));
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "listing", resourceId: listingId, action: "listing.media.remove", reason: "Seller removed listing image", metadata: { attachmentId: id } });
  });
  revalidatePath(`/seller/listings/${listingId}/edit`);
  revalidatePath("/marketplace", "layout");
  revalidatePath("/");
}
