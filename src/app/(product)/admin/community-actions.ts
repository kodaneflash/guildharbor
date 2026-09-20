"use server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/db/transaction";
import { badges, groups, moderationActions, userBadges, userGroups, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { transactionActor } from "@/domains/authorization";
export async function communityAdminAction(_: { message: string }, form: FormData) {
  const access = await requirePermission("admin.manage");
  const parsed = z.object({ kind: z.enum(["group", "badge"]), operation: z.enum(["save", "grant", "revoke"]), id: z.union([z.uuid(), z.literal("")]).default(""), name: z.string().trim().max(80).default(""), slug: z.string().trim().max(80).default(""), description: z.string().trim().max(2000).default(""), username: z.string().trim().max(30).default(""), reason: z.string().trim().min(5).max(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Check the fields and provide an audit reason." }; const data = parsed.data;
  const result = await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    if (data.operation === "save") {
      if (data.name.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) return "Provide a name and lowercase hyphenated slug.";
      if (/trusted|verified.*(?:seller|purchase)|(?:seller|purchase).*verified/i.test(data.name)) return "Community awards cannot impersonate verified marketplace qualifications.";
      if (data.kind === "group") {
        const values = { name: data.name, slug: data.slug, description: data.description };
        if (data.id) await tx.update(groups).set(values).where(eq(groups.id, data.id)); else await tx.insert(groups).values(values);
      } else {
        const values = { name: data.name, slug: data.slug, description: data.description, icon: "BadgeCheck", color: "cyan" };
        if (data.id) await tx.update(badges).set(values).where(eq(badges.id, data.id)); else await tx.insert(badges).values(values);
      }
    } else {
      if (!data.id) return "Select an existing group or badge.";
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.username, data.username.toLowerCase())).for("share"); if (!user) return "Member username not found.";
      if (data.kind === "group") {
        if (data.operation === "grant") await tx.insert(userGroups).values({ userId: user.id, groupId: data.id }).onConflictDoNothing();
        else await tx.delete(userGroups).where(and(eq(userGroups.userId, user.id), eq(userGroups.groupId, data.id)));
      } else {
        if (data.operation === "grant") await tx.insert(userBadges).values({ userId: user.id, badgeId: data.id, awardedById: access.user.id }).onConflictDoUpdate({ target: [userBadges.userId, userBadges.badgeId], set: { revokedAt: null, awardedById: access.user.id } });
        else await tx.update(userBadges).set({ revokedAt: new Date() }).where(and(eq(userBadges.userId, user.id), eq(userBadges.badgeId, data.id)));
      }
    }
    await tx.insert(moderationActions).values({ actorId: access.user.id, action: `${data.kind}.${data.operation}`, reason: data.reason, metadata: { id: data.id, username: data.username, name: data.name } }); return "Community configuration saved.";
  }); revalidatePath("/", "layout"); return { message: result };
}
