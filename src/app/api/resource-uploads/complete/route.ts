import { createHash } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { authorizeFileResource } from "@/domains/delivery/file-service";
import { createReadDatabase } from "@/db/client";
import { attachments, listingRevisions, listings, postAttachments, posts, threads, conversations, conversationMembers, userBlocks, messages, messageAttachments, sellerProfiles, domainAuditEvents } from "@/db/schema";
import { createObjectStorageClient } from "@/lib/storage";
import { env } from "@/lib/env";
import { withTransaction } from "@/db/transaction";
import { notifyMember } from "@/domains/notifications/events";
import { transactionActor, transactionForum } from "@/domains/authorization";
export async function POST(request: Request) {
  const access = await memberApiAccess(request); if (access instanceof Response) return access;
  const input = z.object({ id: z.uuid() }).safeParse(await request.json()); if (!input.success) return Response.json({ error: "Invalid upload" }, { status: 400 });
  const database = createReadDatabase();
  const [file] = await database.select().from(attachments).where(and(eq(attachments.id, input.data.id), eq(attachments.ownerId, access.user.id)));
  if (!file || !file.resourceId || !(await authorizeFileResource(file.purpose, file.resourceId, true))) return Response.json({ error: "Not found" }, { status: 404 });
  if (file.state === "ready" && file.scanStatus === "clean") return Response.json({ id: file.id }, { headers: privateHeaders });
  if (file.state !== "pending") return Response.json({ error: "Upload is not pending" }, { status: 409 });
  const scanner = process.env.FILE_SCANNER_URL; const token = process.env.FILE_SCANNER_TOKEN;
  if (!scanner || !token || new URL(scanner).protocol !== "https:") return Response.json({ error: "Scanner unavailable" }, { status: 503 });
  const storage = createObjectStorageClient(); const object = await storage.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: file.storageKey }));
  if (!object.Body || object.ContentLength !== file.byteSize) return Response.json({ error: "File size mismatch" }, { status: 422 });
  const bytes = Buffer.from(await object.Body.transformToByteArray());
  if (bytes.length !== file.byteSize || createHash("sha256").update(bytes).digest("hex") !== file.checksum) return Response.json({ error: "Checksum mismatch" }, { status: 422 });
  const response = await fetch(scanner, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": file.mediaType }, body: bytes, signal: AbortSignal.timeout(60000), cache: "no-store" });
  if (!response.ok) return Response.json({ error: "Scanner failed; file remains quarantined" }, { status: 503 });
  const scan = z.object({ clean: z.boolean(), sha256: z.string(), mediaType: z.string() }).parse(await response.json());
  if (!scan.clean || scan.sha256 !== file.checksum || scan.mediaType !== file.mediaType) { await database.update(attachments).set({ scanStatus: "rejected", state: "rejected", scannedAt: new Date() }).where(eq(attachments.id, file.id)); return Response.json({ error: "File rejected by secure processing" }, { status: 422 }); }
  const image = file.mediaType.startsWith("image/");
  const processed = image ? await sharp(bytes, { limitInputPixels: 40000000 }).rotate().webp().toBuffer() : bytes;
  if (processed.length > 10485760) return Response.json({ error: "Processed image exceeds the 10 MiB limit" }, { status: 422, headers: privateHeaders });
  const key = `private/resources/${file.id}`; const mediaType = image ? "image/webp" : file.mediaType;
  if (!(await authorizeFileResource(file.purpose, file.resourceId, true))) return Response.json({ error: "Resource access changed" }, { status: 403 });
  const completion = await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id);
    const listingResource = file.purpose === "listing_delivery" || file.purpose === "listing_media";
    const [seller] = listingResource ? await tx.select().from(sellerProfiles).where(and(eq(sellerProfiles.userId, access.user.id), eq(sellerProfiles.status, "active"))).for("share") : [];
    const [listing] = listingResource ? await tx.select().from(listings).where(and(eq(listings.id, file.resourceId ?? ""), eq(listings.sellerId, access.user.id))).for("update") : [];
    if (listingResource && (!listing || listing.status === "removed" || !seller)) throw new Error("Listing unavailable");
    const [current] = await tx.select().from(attachments).where(eq(attachments.id, file.id)).for("update");
    if (!current || current.state !== "pending") throw new Error("Upload state changed");
    if (file.purpose === "listing_media") {
      const gallery = await tx.select({ id: attachments.id }).from(attachments).where(and(eq(attachments.resourceId, listing?.id ?? ""), eq(attachments.purpose, "listing_media"), eq(attachments.state, "ready")));
      if (gallery.length >= 12) return { error: "A listing supports up to 12 images. Remove an image first." };
    }
    if (file.purpose === "post") {
      const [post] = await tx.select().from(posts).where(and(eq(posts.id, Number(file.resourceId)), eq(posts.authorId, access.user.id), isNull(posts.deletedAt))).for("share");
      if (!post) throw new Error("Post unavailable");
      const [thread] = await tx.select().from(threads).where(and(eq(threads.id, post.threadId), eq(threads.status, "open"), isNull(threads.deletedAt))).for("share");
      if (!thread) throw new Error("Thread unavailable");
      await transactionForum(tx, access.user.id, thread.forumId, "reply");
    }
    if (file.purpose === "conversation") {
      const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, file.resourceId ?? "")).for("update");
      const members = await tx.select().from(conversationMembers).where(eq(conversationMembers.conversationId, file.resourceId ?? ""));
      if (!conversation || !members.some(member => member.userId === access.user.id) || !actor.permissions.some(permission => ["message.send", "admin.manage"].includes(permission))) throw new Error("FORBIDDEN");
      if (conversation.type === "direct") {
        const ids = members.map(member => member.userId);
        const blocks = await tx.select().from(userBlocks).where(and(inArray(userBlocks.blockerId, ids), inArray(userBlocks.blockedId, ids)));
        if (blocks.length) throw new Error("Direct contact is blocked");
      }
      const [message] = await tx.insert(messages).values({ conversationId: conversation.id, senderId: access.user.id, clientRequestId: file.id, plainText: "Shared a secure file", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Shared a secure file" }] }] } }).returning();
      await tx.insert(messageAttachments).values({ messageId: message.id, attachmentId: file.id });
      await tx.update(conversations).set({ latestMessageAt: message.createdAt, latestMessageId: message.id }).where(eq(conversations.id, conversation.id));
      for (const member of members) if (member.userId !== access.user.id && (!member.mutedUntil || member.mutedUntil < new Date())) await notifyMember(tx, { userId: member.userId, actorId: access.user.id, type: "message.received", resourceType: "conversation", resourceId: conversation.id, eventKey: `file:${file.id}:${member.userId}`, title: "New private message", href: `/messages/${conversation.id}` });
    }
    await tx.update(attachments).set({ state: "ready", scanStatus: "clean", scannedAt: new Date(), storageKey: key, mediaType, byteSize: processed.length, checksum: createHash("sha256").update(processed).digest("hex") }).where(eq(attachments.id, file.id));
    if (file.purpose === "post") await tx.insert(postAttachments).values({ postId: Number(file.resourceId), attachmentId: file.id }).onConflictDoNothing();
    if (file.purpose === "listing_media") {
      if (!image) throw new Error("Listing media must be an image");
      if (!listing || listing.status === "removed" || !seller) throw new Error("Listing unavailable");
      await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "listing", resourceId: listing.id, action: "listing.media.add", reason: "Seller uploaded a scanned listing image", metadata: { attachmentId: file.id } });
    }
    if (file.purpose === "listing_delivery") {
      if (!listing) throw new Error("Listing unavailable");
      await tx.insert(listingRevisions).values({ listingId: listing.id, version: listing.version + 1, title: listing.title, description: listing.description, priceCents: listing.priceCents, kind: listing.kind, fulfillmentMode: "file", deliveryTerms: listing.deliveryTerms, protectedFileId: file.id });
      await tx.update(listings).set({ version: listing.version + 1, fulfillmentMode: "file", status: "draft" }).where(eq(listings.id, listing.id));
    }
    // Hold the attachment lock through the write: cleanup cannot delete a newly published file.
    await storage.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: processed, ContentType: mediaType }));
  });
  if (completion?.error) return Response.json(completion, { status: 409, headers: privateHeaders });
  await storage.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: file.storageKey }));
  return Response.json({ id: file.id }, { headers: privateHeaders });
}
