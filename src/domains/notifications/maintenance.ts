import "server-only";
import { and, eq, isNull, lt, ne, or } from "drizzle-orm";
import { Resend } from "resend";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { announcements, attachments, categories, conversationMembers, deals, forumAccessRules, forums, notificationOutbox, notificationPreferences, notifications, roles, supportCases, telegramConnections, telegramOutbox, telegramPreferences, threads, userGroups, userRoles, users } from "@/db/schema";
import { announcementTelegramText } from "@/domains/announcements/validation";
import { hasCommunityAccess } from "@/lib/community-access";
import { env, isR2Configured } from "@/lib/env";
import { createObjectStorageClient } from "@/lib/storage";
async function resourceEligible(userId: string, type: string | null, id: string | null) {
  if (!type || !id) return false; const db = createReadDatabase();
  if (type === "announcement") {
    const [row] = await db.select({ id: announcements.id }).from(announcements).where(and(eq(announcements.id, id), isNull(announcements.removedAt))).limit(1);
    return Boolean(row);
  }
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
  const telegram = await deliverTelegramNotifications();
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
      const result = await new Resend(env.RESEND_API_KEY).emails.send({ from: env.AUTH_EMAIL_FROM, to: row.user.email, subject: "You have an Outlaw update", text: `An account update is available. Sign in to view it: ${new URL("/notifications", env.NEXT_PUBLIC_APP_URL).href}\nManage optional email notifications in your account settings.` }, { idempotencyKey: `outlaw-notice-${job.id}` });
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
  return { delivered, skipped, failed, cleaned, telegram, storageCleanupConfigured: isR2Configured };
}

export async function deliverTelegramNotifications() {
  if (!env.TELEGRAM_NOTIFICATIONS_ENABLED || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BRIDGE_SECRET) return { delivered: 0, skipped: 0, failed: 0 };
  const database = createReadDatabase();
  let delivered = 0, skipped = 0, failed = 0;
  for (let index = 0; index < 2; index++) {
    // Claim before contacting Telegram. Its Bot API has no idempotency key, so a
    // timed-out send is never retried automatically and cannot produce a duplicate.
    const job = await withTransaction(async tx => {
      const [pending] = await tx.select().from(telegramOutbox).where(eq(telegramOutbox.status, "pending")).for("update", { skipLocked: true }).limit(1);
      if (!pending) return null;
      await tx.update(telegramOutbox).set({ status: "claimed" }).where(eq(telegramOutbox.notificationId, pending.notificationId));
      return pending;
    });
    if (!job) break;
    const [row] = await database.select({ notice: notifications, user: users }).from(notifications).innerJoin(users, eq(users.id, notifications.userId)).where(eq(notifications.id, job.notificationId));
    if (!row || !hasCommunityAccess(row.user) || !(await resourceEligible(row.user.id, row.notice.resourceType, row.notice.resourceId))) {
      await database.update(telegramOutbox).set({ status: "skipped" }).where(eq(telegramOutbox.notificationId, job.notificationId)); skipped++; continue;
    }
    if (!env.TELEGRAM_BOT_TOKEN || !env.NEXT_PUBLIC_APP_URL) {
      await database.update(telegramOutbox).set({ status: "failed" }).where(eq(telegramOutbox.notificationId, job.notificationId)); failed++; continue;
    }
    const defaultText = `${row.notice.title}\n${new URL(row.notice.href, env.NEXT_PUBLIC_APP_URL).href}\nManage alerts in your account settings.`;
    const status = await withTransaction(async tx => {
      // Disconnect takes this same row lock, so no send can start after it commits.
      const [connection] = await tx.select().from(telegramConnections).where(eq(telegramConnections.userId, row.user.id)).for("update").limit(1);
      const [preference] = connection ? await tx.select().from(telegramPreferences).where(and(eq(telegramPreferences.userId, row.user.id), eq(telegramPreferences.eventType, row.notice.type))).limit(1) : [];
      if (!connection || preference?.enabled === false) {
        await tx.update(telegramOutbox).set({ status: "skipped" }).where(eq(telegramOutbox.notificationId, job.notificationId));
        return "skipped" as const;
      }
      let text = defaultText;
      if (row.notice.resourceType === "announcement") {
        const [announcement] = await tx.select().from(announcements).where(and(eq(announcements.id, row.notice.resourceId ?? ""), isNull(announcements.removedAt))).for("share").limit(1);
        if (!announcement) {
          await tx.update(telegramOutbox).set({ status: "skipped" }).where(eq(telegramOutbox.notificationId, job.notificationId));
          return "skipped" as const;
        }
        text = announcementTelegramText(announcement.title, announcement.content, new URL(row.notice.href, env.NEXT_PUBLIC_APP_URL).href);
      }
      let sent = false;
      try {
        const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: connection.privateChatId.toString(), text, disable_web_page_preview: true }), signal: AbortSignal.timeout(10000) });
        sent = response.ok;
      } catch {
        // Telegram may have accepted a timed-out request. Never retry it.
      }
      await tx.update(telegramOutbox).set({ status: sent ? "delivered" : "failed" }).where(eq(telegramOutbox.notificationId, job.notificationId));
      return sent ? "delivered" as const : "failed" as const;
    });
    if (status === "delivered") delivered++; else if (status === "skipped") skipped++; else failed++;
  }
  return { delivered, skipped, failed };
}
