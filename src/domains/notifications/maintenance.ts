import "server-only";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { Resend } from "resend";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { attachments, categories, conversationMembers, deals, forumAccessRules, forums, notificationOutbox, notificationPreferences, notifications, roles, supportCases, threads, userGroups, userRoles, users } from "@/db/schema";
import { hasCommunityAccess } from "@/lib/community-access";
import { env, isR2Configured } from "@/lib/env";
import { createObjectStorageClient } from "@/lib/storage";
async function resourceEligible(userId: string, type: string | null, id: string | null) {
  if (!type || !id) return false; const db = createReadDatabase();
  if (type === "conversation") { const rows = await db.select().from(conversationMembers).where(and(eq(conversationMembers.userId, userId), eq(conversationMembers.conversationId, id))); return rows.some(member => !member.mutedUntil || member.mutedUntil < new Date()); }
  if (type === "deal") { const [deal] = await db.select().from(deals).where(eq(deals.id, id)); return Boolean(deal && (deal.creatorId === userId || deal.respondentId === userId && deal.state !== "DRAFT")); }
  if (type === "support") {
    const [record] = await db.select().from(supportCases).where(eq(supportCases.id, id));
    if (!record) return false;
    if (record.creatorId === userId) return true;
    if (record.assignedToId !== userId) return false;
    const assigned = await db.select({ permissions: roles.permissions }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId));
    return assigned.some(role => role.permissions.some(permission => ["support.manage", "admin.manage"].includes(permission)));
  }
  if (type === "thread") {
    const [row] = await db.select({ forum: forums }).from(threads).innerJoin(forums, eq(forums.id, threads.forumId)).innerJoin(categories, eq(categories.id, forums.categoryId)).where(and(eq(threads.id, Number(id)), isNull(threads.deletedAt), ne(threads.status, "deleted"), eq(categories.isVisible, true)));
    if (!row) return false; if (!row.forum.isPrivate) return true;
    const assigned = await db.select({ roleId: roles.id, permissions: roles.permissions }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, userId));
    if (assigned.some(role => role.permissions.includes("admin.manage"))) return true;
    const groups = await db.select().from(userGroups).where(eq(userGroups.userId, userId)); const rules = await db.select().from(forumAccessRules).where(eq(forumAccessRules.forumId, row.forum.id));
    return rules.some(rule => rule.canRead && (assigned.some(role => role.roleId === rule.roleId) || groups.some(group => group.groupId === rule.groupId)));
  }
  return false;
}
export async function runMaintenance() {
  const database = createReadDatabase(); let delivered = 0; let skipped = 0; let failed = 0; let cleaned = 0;
  for (let index = 0; index < 20; index++) {
    const job = await withTransaction(async tx => {
      const [pending] = await tx.select().from(notificationOutbox).where(and(lt(notificationOutbox.availableAt, new Date()), or(eq(notificationOutbox.status, "pending"), and(eq(notificationOutbox.status, "processing"), lt(notificationOutbox.leaseUntil, new Date()))))).for("update", { skipLocked: true }).limit(1);
      if (!pending) return null;
      await tx.update(notificationOutbox).set({ status: "processing", attempts: pending.attempts + 1, leaseUntil: new Date(Date.now() + 120000) }).where(eq(notificationOutbox.id, pending.id)); return pending;
    });
    if (!job) break;
    const [row] = await database.select({ notice: notifications, user: users }).from(notifications).innerJoin(users, eq(users.id, notifications.userId)).where(eq(notifications.id, job.notificationId));
    const [preference] = row ? await database.select().from(notificationPreferences).where(and(eq(notificationPreferences.userId, row.user.id), eq(notificationPreferences.eventType, row.notice.type))) : [];
    if (!row || !hasCommunityAccess(row.user) || !preference?.email || !(await resourceEligible(row.user.id, row.notice.resourceType, row.notice.resourceId))) {
      await database.update(notificationOutbox).set({ status: "skipped", leaseUntil: null }).where(eq(notificationOutbox.id, job.id)); skipped++; continue;
    }
    if (!env.RESEND_API_KEY || !env.AUTH_EMAIL_FROM || !env.NEXT_PUBLIC_APP_URL) {
      await database.update(notificationOutbox).set({ status: "pending", lastError: "Email configuration unavailable", availableAt: new Date(Date.now() + 300000), leaseUntil: null }).where(eq(notificationOutbox.id, job.id)); failed++; break;
    }
    // Resend's idempotency key protects retries after a provider-success/database-failure window.
    try {
      const result = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.AUTH_EMAIL_FROM, to: row.user.email, subject: "You have a GuildHarbor update", text: `An account update is available. Sign in to view it: ${new URL("/notifications", env.NEXT_PUBLIC_APP_URL).href}\nManage optional email notifications in your account settings.` }, { idempotencyKey: `guildharbor-notice-${job.id}` });
      if (result.error) throw new Error("Email provider rejected delivery");
      await database.update(notificationOutbox).set({ status: "delivered", deliveredAt: new Date(), leaseUntil: null, lastError: null }).where(eq(notificationOutbox.id, job.id)); delivered++;
    } catch {
      // Persist a retryable operational failure without logging provider payloads or recipient data.
      await database.update(notificationOutbox).set({ status: job.attempts >= 4 ? "failed" : "pending", lastError: "Email delivery failed; review provider status before retrying exhausted jobs", availableAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts)), leaseUntil: null }).where(eq(notificationOutbox.id, job.id)); failed++;
    }
  }
  if (isR2Configured) {
    const stale = await database.select().from(attachments).where(and(or(eq(attachments.state, "pending"), eq(attachments.state, "rejected")), lt(attachments.createdAt, new Date(Date.now() - 86400000)))).limit(50);
    const storage = createObjectStorageClient();
    for (const file of stale) {
      const removed = await withTransaction(async tx => {
        const [current] = await tx.select().from(attachments).where(and(eq(attachments.id, file.id), or(eq(attachments.state, "pending"), eq(attachments.state, "rejected")))).for("update", { skipLocked: true });
        if (!current) return false;
        await storage.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: current.storageKey }));
        if (current.resourceId) await storage.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: `private/resources/${current.id}` }));
        await tx.update(attachments).set({ state: "deleted" }).where(eq(attachments.id, current.id));
        return true;
      });
      if (removed) cleaned++;
    }
  }
  return { delivered, skipped, failed, cleaned, storageCleanupConfigured: isR2Configured };
}
