import "server-only";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "@/db/transaction";
import { categories, forumAccessRules, forums, roles, userGroups, userRoles, users } from "@/db/schema";
import { hasCommunityAccess } from "@/lib/community-access";

export async function transactionActor(database: DatabaseTransaction, actorId: string) {
  const [actor] = await database.select().from(users).where(eq(users.id, actorId)).for("share");
  if (!actor || !hasCommunityAccess(actor)) throw new Error("FORBIDDEN");
  const assigned = await database.select({ permissions: roles.permissions }).from(userRoles).innerJoin(roles, eq(roles.id, userRoles.roleId)).where(eq(userRoles.userId, actorId)).for("share");
  return { actor, permissions: assigned.flatMap(role => role.permissions) };
}
export async function transactionForum(database: DatabaseTransaction, actorId: string, forumId: number, operation: "read" | "create" | "reply" = "read") {
  const access = await transactionActor(database, actorId);
  const [forum] = await database.select({ isPrivate: forums.isPrivate }).from(forums).innerJoin(categories, eq(categories.id, forums.categoryId)).where(and(eq(forums.id, forumId), eq(categories.isVisible, true))).for("share");
  if (!forum) throw new Error("FORBIDDEN");
  if (access.permissions.includes("admin.manage")) return access;
  if (operation !== "read" && !access.permissions.includes(operation === "create" ? "thread.create" : "thread.reply")) throw new Error("FORBIDDEN");
  if (!forum.isPrivate) return access;
  const assignedRoles = await database.select().from(userRoles).where(eq(userRoles.userId, actorId)).for("share");
  const assignedGroups = await database.select().from(userGroups).where(eq(userGroups.userId, actorId)).for("share");
  const rules = await database.select().from(forumAccessRules).where(eq(forumAccessRules.forumId, forumId)).for("share");
  if (!rules.some(rule => rule.canRead && (operation === "read" || (operation === "create" ? rule.canCreateThread : rule.canReply)) && ((rule.roleId && assignedRoles.some(role => role.roleId === rule.roleId)) || (rule.groupId && assignedGroups.some(group => group.groupId === rule.groupId))))) throw new Error("FORBIDDEN");
  return access;
}
