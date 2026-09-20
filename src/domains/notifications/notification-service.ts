import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { conversationMembers, notificationPreferences, notifications, supportCases } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { findThread, findForum } from "@/db/queries/community";
import { findDeal } from "@/domains/deals/deal-service";
import { transactionActor } from "@/domains/authorization";
export const notificationTypes = ["message.received", "thread.reply", "deal.updated", "support.updated"] as const;
export async function visibleNotifications(page = 1) {
  const access = await requireMember(); const database = createReadDatabase();
  const [rows, preferences] = await Promise.all([database.select().from(notifications).where(eq(notifications.userId, access.user.id)).orderBy(desc(notifications.id)).limit(51).offset((page - 1) * 50), database.select().from(notificationPreferences).where(eq(notificationPreferences.userId, access.user.id))]);
  const visible = [];
  for (const row of rows.slice(0, 50)) {
    if (preferences.some(preference => preference.eventType === row.type && !preference.inApp)) continue;
    let allowed = false;
    if (row.resourceType === "conversation" && row.resourceId) {
      const [member] = await database.select({ id: conversationMembers.userId }).from(conversationMembers).where(and(eq(conversationMembers.conversationId, row.resourceId), eq(conversationMembers.userId, access.user.id)));
      allowed = Boolean(member);
    } else if (row.resourceType === "deal" && row.resourceId) allowed = Boolean(await findDeal(row.resourceId));
    else if (row.resourceType === "support" && row.resourceId) {
      const [record] = await database.select({ owner: supportCases.creatorId, assignee: supportCases.assignedToId }).from(supportCases).where(eq(supportCases.id, row.resourceId));
      allowed = Boolean(record && (record.owner === access.user.id || record.assignee === access.user.id && access.permissions.some(permission => ["support.manage", "admin.manage"].includes(permission))));
    }
    else { const thread = /^\/threads\/(\d+)\//.exec(row.href); const forum = /^\/forums\/([^/?#]+)$/.exec(row.href); allowed = Boolean(thread && await findThread(Number(thread[1])) || forum && await findForum(forum[1])); }
    if (allowed) visible.push(row);
  }
  return { rows: visible, hasMore: rows.length > 50 };
}
export async function saveNotificationPreferences(input: unknown) {
  const data = z.array(z.object({ eventType: z.enum(notificationTypes), inApp: z.boolean(), email: z.boolean() })).length(notificationTypes.length).parse(input);
  if (new Set(data.map(item => item.eventType)).size !== notificationTypes.length) throw new Error("Duplicate preference");
  const access = await requireMember();
  await withTransaction(async tx => { await transactionActor(tx, access.user.id); for (const preference of data) await tx.insert(notificationPreferences).values({ ...preference, userId: access.user.id }).onConflictDoUpdate({ target: [notificationPreferences.userId, notificationPreferences.eventType], set: { inApp: preference.inApp, email: preference.email, updatedAt: new Date() } }); });
}
export async function readNotification(id: number) { const access = await requireMember(); z.number().int().positive().safe().parse(id); await createReadDatabase().update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, access.user.id))); }
