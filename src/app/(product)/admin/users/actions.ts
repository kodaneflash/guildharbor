"use server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/db/transaction";
import { moderationActions, roles, sessions, userRoles, users } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { transactionActor } from "@/domains/authorization";
export async function userModerationAction(_: { message: string }, form: FormData) {
  const access = await requirePermission("admin.manage"); const input = z.object({ userId: z.string().min(1), status: z.enum(["active", "restricted", "suspended", "banned"]), reason: z.string().trim().min(5).max(2000) }).safeParse(Object.fromEntries(form));
  if (!input.success) return { message: "Choose a status and explain the decision." }; const data = input.data;
  if (data.userId === access.user.id) return { message: "You cannot change your own access through moderation." };
  await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    const [subject] = await tx.select().from(users).where(eq(users.id, data.userId)).for("update"); if (!subject || subject.accountStatus === "deleted") throw new Error("Account unavailable");
    const assigned = await tx.select({ permissions: roles.permissions }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, data.userId));
    if (assigned.some(role => role.permissions.includes("admin.manage"))) throw new Error("Administrator restrictions require a separate operator recovery procedure");
    if (data.status === "active" && (!subject.emailVerified || !subject.username)) throw new Error("Account must complete verification and username onboarding first");
    await tx.update(users).set({ accountStatus: data.status }).where(eq(users.id, data.userId));
    if (data.status !== "active") await tx.delete(sessions).where(eq(sessions.userId, data.userId));
    await tx.insert(moderationActions).values({ actorId: access.user.id, subjectUserId: data.userId, action: `account.${data.status}`, reason: data.reason, metadata: { previousStatus: subject.accountStatus } });
  }); revalidatePath("/", "layout"); return { message: "Account status saved and affected sessions revoked." };
}
