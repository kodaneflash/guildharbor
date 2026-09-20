import "server-only";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { attachments, conversationMembers, conversations, listings, posts, sellerProfiles, userBlocks, users } from "@/db/schema";
import { requireMember, requireForum } from "@/lib/session";
import { findThread } from "@/db/queries/community";
import { communityMemberFilter } from "@/lib/community-access";
import { z } from "zod";
export const resourcePurpose = z.enum(["listing_delivery", "listing_media", "conversation", "post"]);
export const allowedMediaTypes = ["application/pdf", "text/plain", "application/zip", "image/jpeg", "image/png", "image/webp"] as const;
export async function authorizeFileResource(purpose: string, resourceId: string, write: boolean) {
  const access = await requireMember(); const database = createReadDatabase();
  if (purpose === "listing_media") {
    if (!z.uuid().safeParse(resourceId).success) return false;
    const [row] = await database.select({ owner: listings.sellerId, status: listings.status }).from(listings)
      .innerJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId))
      .innerJoin(users, eq(users.id, listings.sellerId))
      .where(and(eq(listings.id, resourceId), eq(sellerProfiles.status, "active"), communityMemberFilter()));
    return Boolean(row && row.status !== "removed" && (row.owner === access.user.id || !write && row.status === "published"));
  }
  if (purpose === "listing_delivery") {
    if (!z.uuid().safeParse(resourceId).success) return false;
    const [listing] = await database.select({ owner: listings.sellerId, status: listings.status }).from(listings).innerJoin(sellerProfiles, eq(sellerProfiles.userId, listings.sellerId)).where(and(eq(listings.id, resourceId), eq(listings.sellerId, access.user.id), eq(sellerProfiles.status, "active")));
    return Boolean(listing && listing.status !== "removed"); // Buyers never have a pre-funding release entitlement.
  }
  if (purpose === "conversation") {
    if (!z.uuid().safeParse(resourceId).success) return false;
    const [member] = await database.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, resourceId), eq(conversationMembers.userId, access.user.id)));
    if (!member || (write && !access.permissions.includes("message.send") && !access.permissions.includes("admin.manage"))) return false;
    if (write) {
      const [conversation] = await database.select().from(conversations).where(eq(conversations.id, resourceId));
      if (!conversation) return false;
      if (conversation.type === "direct") {
        const members = await database.select().from(conversationMembers).where(eq(conversationMembers.conversationId, resourceId));
        const ids = members.map(member => member.userId);
        const blocks = await database.select().from(userBlocks).where(and(inArray(userBlocks.blockerId, ids), inArray(userBlocks.blockedId, ids)));
        if (blocks.length) return false;
      }
    }
    return true;
  }
  if (purpose === "post") {
    const id = Number(resourceId); if (!Number.isSafeInteger(id) || id < 1) return false;
    const [post] = await database.select().from(posts).where(and(eq(posts.id, id), isNull(posts.deletedAt)));
    if (!post) return false; const thread = await findThread(post.threadId); if (!thread) return false;
    if (write) { await requireForum(thread.forumId, "reply"); return post.authorId === access.user.id && thread.status === "open"; }
    return true;
  }
  return false;
}
export async function resourceFiles(purpose: string, resourceId: string) {
  if (!(await authorizeFileResource(purpose, resourceId, false))) return [];
  return createReadDatabase().select({ id: attachments.id, name: attachments.originalName, mediaType: attachments.mediaType, state: attachments.state, scanStatus: attachments.scanStatus }).from(attachments).where(and(eq(attachments.purpose, purpose), eq(attachments.resourceId, resourceId), eq(attachments.state, "ready"), eq(attachments.scanStatus, "clean"))).orderBy(attachments.createdAt, attachments.id);
}
