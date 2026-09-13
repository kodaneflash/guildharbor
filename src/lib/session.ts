import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { createReadDatabase } from "@/db/client";
import {
  users,
  roles,
  userRoles,
  forums,
  categories,
  forumAccessRules,
  userGroups,
} from "@/db/schema";
import { hasCommunityAccess } from "@/lib/community-access";

export const getSession = cache(async () =>
  auth ? auth.api.getSession({ headers: await headers() }) : null,
);
export const getAccess = cache(async () => {
  const session = await getSession();
  if (!session)
    return {
      session: null,
      user: null,
      allowed: false,
      permissions: [] as string[],
    };
  const database = createReadDatabase();
  const [user] = await database
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!user)
    return {
      session: null,
      user: null,
      allowed: false,
      permissions: [] as string[],
    };
  const assigned = await database
    .select({ permissions: roles.permissions })
    .from(userRoles)
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(eq(userRoles.userId, user.id));
  return {
    session,
    user,
    allowed: hasCommunityAccess(user),
    permissions: assigned.flatMap((role) => role.permissions),
  };
});
export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
export async function requireMember() {
  const access = await getAccess();
  if (!access.allowed || !access.user || !access.session)
    throw new Error("FORBIDDEN");
  return { ...access, user: access.user, session: access.session };
}
export async function requirePermission(permission: string) {
  const access = await requireMember();
  if (
    !access.permissions.includes(permission) &&
    !access.permissions.includes("admin.manage")
  )
    throw new Error("FORBIDDEN");
  return access;
}
export async function canAccessForum(
  forumId: number,
  operation: "read" | "create" | "reply" = "read",
) {
  const access = await requireMember();
  const database = createReadDatabase();
  const [forum] = await database
    .select({ isPrivate: forums.isPrivate })
    .from(forums)
    .innerJoin(categories, eq(categories.id, forums.categoryId))
    .where(and(eq(forums.id, forumId), eq(categories.isVisible, true)))
    .limit(1);
  if (!forum) return false;
  if (access.permissions.includes("admin.manage")) return true;
  if (
    operation !== "read" &&
    !access.permissions.includes(
      operation === "create" ? "thread.create" : "thread.reply",
    )
  )
    return false;
  if (!forum.isPrivate) return true;
  const [rules, assignedRoles, assignedGroups] = await Promise.all([
    database
      .select()
      .from(forumAccessRules)
      .where(eq(forumAccessRules.forumId, forumId)),
    database
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, access.user.id)),
    database
      .select()
      .from(userGroups)
      .where(eq(userGroups.userId, access.user.id)),
  ]);
  return rules.some(
    (rule) =>
      ((rule.roleId &&
        assignedRoles.some((role) => role.roleId === rule.roleId)) ||
        (rule.groupId &&
          assignedGroups.some((group) => group.groupId === rule.groupId))) &&
      rule.canRead &&
      (operation === "read" ||
        (operation === "create" ? rule.canCreateThread : rule.canReply)),
  );
}
export async function requireForum(
  forumId: number,
  operation: "read" | "create" | "reply" = "read",
) {
  if (!(await canAccessForum(forumId, operation))) throw new Error("FORBIDDEN");
}
