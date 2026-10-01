import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { announcements, domainAuditEvents, notifications, telegramConnections, telegramOutbox, telegramPreferences, users } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { transactionActor } from "@/domains/authorization";
import { communityMemberFilter } from "@/lib/community-access";
import { requireMember, requirePermission } from "@/lib/session";
import { announcementInputSchema } from "./validation";

export async function listAnnouncements(page = 1, pageSize = 20) {
  await requireMember();
  z.number().int().min(1).max(100_000).parse(page);
  z.number().int().min(1).max(20).parse(pageSize);
  const rows = await createReadDatabase().select().from(announcements)
    .where(isNull(announcements.removedAt))
    .orderBy(desc(announcements.pinned), desc(announcements.publishedAt), desc(announcements.id))
    .limit(pageSize + 1).offset((page - 1) * pageSize);
  return { rows: rows.slice(0, pageSize), hasMore: rows.length > pageSize };
}

export async function findAnnouncement(id: string) {
  await requireMember();
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await createReadDatabase().select().from(announcements)
    .where(and(eq(announcements.id, id), isNull(announcements.removedAt))).limit(1);
  return row ?? null;
}

type MutationResult = { id: string } | { error: string };

export async function saveAnnouncement(input: unknown, operation: "publish" | "edit"): Promise<MutationResult> {
  z.enum(["publish", "edit"]).parse(operation);
  const access = await requirePermission("admin.manage");
  const data = announcementInputSchema.parse(input);
  return withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id);
    if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    const { id, ...values } = data;
    if (operation === "edit") {
      const [row] = await tx.update(announcements).set(values)
        .where(and(eq(announcements.id, id), isNull(announcements.removedAt))).returning({ id: announcements.id });
      if (!row) return { error: "Announcement is unavailable." };
    } else {
      const [row] = await tx.insert(announcements).values({ id, ...values, authorId: access.user.id })
        .onConflictDoNothing({ target: announcements.id }).returning({ id: announcements.id });
      if (!row) return { error: "This announcement has already been submitted. Refresh to view it." };
      // One set-based fan-out in the publication transaction. These transport-only
      // records are marked read and excluded from inbox pagination.
      await tx.execute(sql`
        with recipients as (
          insert into ${notifications} (user_id, actor_id, type, resource_type, resource_id, event_key, title, href, read_at)
          select ${users.id}, ${access.user.id}, 'announcement.published', 'announcement', ${id},
            'announcement:' || ${id} || ':' || ${users.id}, ${values.title}, ${`/announcements/${id}`}, current_timestamp
          from ${users}
          inner join ${telegramConnections} on ${telegramConnections.userId} = ${users.id}
          left join ${telegramPreferences} on ${telegramPreferences.userId} = ${users.id}
            and ${telegramPreferences.eventType} = 'announcement.published'
          where ${communityMemberFilter()} and (${telegramPreferences.enabled} is null or ${telegramPreferences.enabled} = true)
          on conflict (event_key) do nothing
          returning id
        )
        insert into ${telegramOutbox} (notification_id) select id from recipients
      `);
    }
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "announcement", resourceId: id,
      action: `announcement.${operation}`, reason: operation === "publish" ? "Administrator published announcement" : "Administrator edited announcement",
      metadata: { pinned: values.pinned, important: values.important } });
    return { id };
  });
}

export async function removeAnnouncement(input: unknown): Promise<MutationResult> {
  const access = await requirePermission("admin.manage");
  const id = z.uuid().parse(input);
  return withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id);
    if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    const [row] = await tx.update(announcements).set({ removedAt: new Date() })
      .where(and(eq(announcements.id, id), isNull(announcements.removedAt))).returning({ id: announcements.id });
    if (!row) return { error: "Announcement is unavailable." };
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "announcement", resourceId: id,
      action: "announcement.remove", reason: "Administrator removed announcement" });
    return { id };
  });
}
