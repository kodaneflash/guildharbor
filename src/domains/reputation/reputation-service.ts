import "server-only";

import { eq, sql } from "drizzle-orm";

import { profiles, reputationEvents } from "@/db/schema";
import { withTransaction } from "@/db/transaction";

export async function giveReputation(input: { giverId: string; recipientId: string; value: -1 | 1; reason: string; threadId?: number; postId?: number }) {
  if (input.giverId === input.recipientId) throw new Error("SELF_REPUTATION");
  if (input.reason.trim().length < 5 || input.reason.length > 500) throw new Error("INVALID_REASON");
  return withTransaction(async (database) => {
    const [event] = await database.insert(reputationEvents).values({ ...input, reason: input.reason.trim() }).returning({ id: reputationEvents.id });
    await database.update(profiles).set({ reputation: sql`greatest(0, ${profiles.reputation} + ${input.value})` }).where(eq(profiles.userId, input.recipientId));
    return event;
  });
}

export async function reverseReputation(input: { moderatorId: string; eventId: number; reason: string }) {
  return withTransaction(async (database) => {
    const [source] = await database.select().from(reputationEvents).where(eq(reputationEvents.id, input.eventId)).limit(1);
    if (!source || source.reversalOfId) throw new Error("INVALID_REPUTATION_EVENT");
    const [reversal] = await database.insert(reputationEvents).values({ giverId: input.moderatorId, recipientId: source.recipientId, value: source.value === 1 ? -1 : 1, reason: input.reason, reversalOfId: source.id }).returning({ id: reputationEvents.id });
    await database.update(profiles).set({ reputation: sql`greatest(0, ${profiles.reputation} - ${source.value})` }).where(eq(profiles.userId, source.recipientId));
    return reversal;
  });
}
