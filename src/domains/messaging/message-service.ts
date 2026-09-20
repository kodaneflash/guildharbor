import "server-only";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { conversationMembers, conversations, messages, reports, supportCases, supportEvents, userBlocks, users } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { transactionActor } from "@/domains/authorization";
import { notifyMember } from "@/domains/notifications/events";
import { requireMember } from "@/lib/session";
import { hasCommunityAccess } from "@/lib/community-access";
import { enforceRateLimit } from "@/lib/rate-limit";
import { usernameSchema } from "@/lib/validation";

export async function startConversation(username: unknown) {
  const access = await requireMember();
  const parsedUsername = usernameSchema.safeParse(username);
  if (!parsedUsername.success) return { error: "Enter a valid member username." };
  const targetName = parsedUsername.data;
  await enforceRateLimit("message", access.user.id);
  return withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id);
    if (!actor.permissions.includes("message.send") && !actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    const [recipient] = await tx.select().from(users).where(eq(users.username, targetName)).for("share");
    if (!recipient || !hasCommunityAccess(recipient) || recipient.id === access.user.id) return { error: "Choose another eligible member's username." };
    const [low, high] = [access.user.id, recipient.id].sort();
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${low}:${high}`}, 0))`);
    const blocks = await tx.select().from(userBlocks).where(or(and(eq(userBlocks.blockerId, low), eq(userBlocks.blockedId, high)), and(eq(userBlocks.blockerId, high), eq(userBlocks.blockedId, low))));
    if (blocks.length) return { error: "Direct contact is unavailable between these accounts." };
    const [existing] = await tx.select().from(conversations).where(and(eq(conversations.directUserLowId, low), eq(conversations.directUserHighId, high)));
    if (existing) { await tx.update(conversationMembers).set({ archivedAt: null }).where(and(eq(conversationMembers.conversationId, existing.id), eq(conversationMembers.userId, access.user.id))); return { id: existing.id }; }
    const [conversation] = await tx.insert(conversations).values({ type: "direct", directUserLowId: low, directUserHighId: high }).returning({ id: conversations.id });
    await tx.insert(conversationMembers).values([{ conversationId: conversation.id, userId: low }, { conversationId: conversation.id, userId: high }]);
    return { id: conversation.id };
  });
}
export const sendMessageSchema = z.object({ conversationId: z.uuid(), requestId: z.uuid(), text: z.string().trim().min(1).max(20000), replyToId: z.coerce.number().int().positive().safe().optional() });
export async function sendMessage(input: unknown) {
  const data = sendMessageSchema.parse(input); const access = await requireMember(); await enforceRateLimit("message", access.user.id);
  return withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id);
    if (!actor.permissions.includes("message.send") && !actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, data.conversationId)).for("update");
    const members = await tx.select().from(conversationMembers).where(eq(conversationMembers.conversationId, data.conversationId));
    if (!conversation || !members.some(member => member.userId === access.user.id)) throw new Error("FORBIDDEN");
    if (conversation.type === "direct") {
      const blocked = await tx.select().from(userBlocks).where(and(inArray(userBlocks.blockerId, members.map(member => member.userId)), inArray(userBlocks.blockedId, members.map(member => member.userId))));
      if (blocked.length) return { error: "Direct messaging is blocked between these accounts." };
    }
    const [existing] = await tx.select().from(messages).where(and(eq(messages.senderId, access.user.id), eq(messages.clientRequestId, data.requestId)));
    if (existing) {
      if (existing.conversationId !== data.conversationId || existing.plainText !== data.text || existing.replyToMessageId !== (data.replyToId ?? null)) return { error: "This request identifier was already used for different content." };
      return { id: existing.id };
    }
    if (data.replyToId) {
      const [reply] = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.id, data.replyToId), eq(messages.conversationId, data.conversationId)));
      if (!reply) return { error: "The reply must refer to this conversation." };
    }
    const [message] = await tx.insert(messages).values({ conversationId: data.conversationId, senderId: access.user.id, clientRequestId: data.requestId, plainText: data.text, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: data.text }] }] }, replyToMessageId: data.replyToId }).returning({ id: messages.id, createdAt: messages.createdAt });
    await tx.update(conversations).set({ latestMessageId: message.id, latestMessageAt: message.createdAt }).where(eq(conversations.id, data.conversationId));
    await tx.update(conversationMembers).set({ archivedAt: null }).where(eq(conversationMembers.conversationId, data.conversationId));
    await tx.update(conversationMembers).set({ lastReadMessageId: message.id }).where(and(eq(conversationMembers.conversationId, data.conversationId), eq(conversationMembers.userId, access.user.id)));
    for (const member of members) if (member.userId !== access.user.id && (!member.mutedUntil || member.mutedUntil < new Date())) await notifyMember(tx, { userId: member.userId, actorId: access.user.id, type: "message.received", resourceType: "conversation", resourceId: data.conversationId, eventKey: `message:${message.id}:${member.userId}`, title: "New private message", href: `/messages/${data.conversationId}` });
    return { id: message.id };
  });
}
export async function conversationOperation(input: unknown) {
  const data = z.object({ conversationId: z.uuid(), operation: z.enum(["read", "archive", "restore", "mute", "unmute", "block", "unblock", "report"]), messageId: z.coerce.number().int().positive().safe().optional(), reason: z.string().trim().max(2000).optional() }).parse(input);
  const access = await requireMember();
  if (data.operation === "report") await enforceRateLimit("report", access.user.id);
  return withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    const [conversation] = await tx.select().from(conversations).where(eq(conversations.id, data.conversationId)).for("update");
    const members = await tx.select().from(conversationMembers).where(eq(conversationMembers.conversationId, data.conversationId));
    if (!conversation || !members.some(member => member.userId === access.user.id)) throw new Error("FORBIDDEN");
    const owned = and(eq(conversationMembers.conversationId, data.conversationId), eq(conversationMembers.userId, access.user.id));
    if (data.operation === "read") {
      if (!data.messageId) return;
      const [message] = await tx.select({ id: messages.id }).from(messages).where(and(eq(messages.id, data.messageId), eq(messages.conversationId, data.conversationId)));
      if (!message) throw new Error("Invalid read cursor");
      await tx.update(conversationMembers).set({ lastReadMessageId: sql`greatest(coalesce(${conversationMembers.lastReadMessageId},0), ${message.id})` }).where(owned);
    } else if (["block", "unblock"].includes(data.operation)) {
      if (conversation.type !== "direct") throw new Error("Deal and order evidence cannot be blocked");
      const other = members.find(member => member.userId !== access.user.id); if (!other) throw new Error("Recipient unavailable");
      const [low, high] = [access.user.id, other.userId].sort();
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${low}:${high}`}, 0))`);
      if (data.operation === "block") await tx.insert(userBlocks).values({ blockerId: access.user.id, blockedId: other.userId }).onConflictDoNothing();
      else await tx.delete(userBlocks).where(and(eq(userBlocks.blockerId, access.user.id), eq(userBlocks.blockedId, other.userId)));
    } else if (data.operation === "report") {
      if (!data.messageId || !data.reason || data.reason.length < 5) throw new Error("Select a message and provide a reason");
      const [message] = await tx.select().from(messages).where(and(eq(messages.id, data.messageId), eq(messages.conversationId, data.conversationId)));
      if (!message) throw new Error("Message unavailable");
      await tx.insert(reports).values({ reporterId: access.user.id, targetMessageId: message.id, category: "message", reason: data.reason });
      const [support] = await tx.insert(supportCases).values({ creatorId: access.user.id, conversationId: conversation.id, subject: `Message report #${message.id}` }).returning();
      await tx.insert(supportEvents).values({ caseId: support.id, actorId: access.user.id, kind: "opened", body: data.reason });
    } else await tx.update(conversationMembers).set(data.operation === "archive" ? { archivedAt: new Date() } : data.operation === "restore" ? { archivedAt: null } : data.operation === "mute" ? { mutedUntil: new Date("9999-01-01T00:00:00Z") } : { mutedUntil: null }).where(owned);
  });
}
