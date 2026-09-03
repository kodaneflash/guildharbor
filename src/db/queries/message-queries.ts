import "server-only";

import { and, desc, eq, lt } from "drizzle-orm";

import type { ReadDatabase } from "@/db/client";
import { conversationMembers, messages } from "@/db/schema";

export async function listConversationMessages(database: ReadDatabase, actorId: string, conversationId: string, beforeId?: number, limit = 50) {
  const [membership] = await database
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, actorId)))
    .limit(1);
  if (!membership) return null;

  return database
    .select({ id: messages.id, senderId: messages.senderId, content: messages.content, plainText: messages.plainText, replyToMessageId: messages.replyToMessageId, createdAt: messages.createdAt, editedAt: messages.editedAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conversationId), beforeId ? lt(messages.id, beforeId) : undefined))
    .orderBy(desc(messages.id))
    .limit(Math.min(limit, 50));
}
