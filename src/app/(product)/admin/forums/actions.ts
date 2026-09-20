"use server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/db/transaction";
import { categories, forumAccessRules, forums, moderationActions } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { transactionActor } from "@/domains/authorization";
const base = z.object({ kind: z.enum(["category", "forum", "access"]), id: z.coerce.number().int().nonnegative().safe().default(0), title: z.string().trim().max(120).default(""), slug: z.string().trim().max(100).default(""), description: z.string().trim().max(3000).default(""), categoryId: z.coerce.number().int().nonnegative().default(0), parentId: z.coerce.number().int().nonnegative().default(0), position: z.coerce.number().int().min(0).max(100000).default(0), roleId: z.union([z.uuid(), z.literal("")]).optional(), groupId: z.union([z.uuid(), z.literal("")]).optional() });
export async function forumAdminAction(_: { message: string }, form: FormData) {
  const access = await requirePermission("admin.manage"); const parsed = base.safeParse(Object.fromEntries(form)); if (!parsed.success) return { message: "Invalid forum configuration." }; const data = parsed.data;
  if (data.kind !== "access" && (data.title.length < 2 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug))) return { message: "Enter a title and lowercase hyphenated slug." };
  const result = await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    await tx.execute(sql`select pg_advisory_xact_lock(714082917)`);
    if (data.kind === "category") {
      const values = { title: data.title, slug: data.slug, description: data.description, position: data.position, isVisible: form.get("visible") === "on" };
      if (data.id) await tx.update(categories).set(values).where(eq(categories.id, data.id)); else await tx.insert(categories).values(values);
    } else if (data.kind === "forum") {
      const all = await tx.select().from(forums).for("update"); let parent = data.parentId; const visited = new Set<number>();
      while (parent) { if (parent === data.id || visited.has(parent)) return "Forum hierarchy cannot contain cycles."; visited.add(parent); const row = all.find(forum => forum.id === parent); if (!row) return "Parent forum unavailable."; parent = row.parentForumId ?? 0; }
      const [category] = await tx.select().from(categories).where(eq(categories.id, data.categoryId)); if (!category) return "Select an existing category.";
      const values = { categoryId: data.categoryId, parentForumId: data.parentId || null, title: data.title, slug: data.slug, description: data.description, position: data.position, isPrivate: form.get("private") === "on" };
      if (data.id) await tx.update(forums).set(values).where(eq(forums.id, data.id)); else await tx.insert(forums).values(values);
    } else {
      if (!data.id || Boolean(data.roleId) === Boolean(data.groupId)) return "Select exactly one role or group and an existing forum.";
      await tx.insert(forumAccessRules).values({ forumId: data.id, roleId: data.roleId || null, groupId: data.groupId || null, canRead: form.get("read") === "on", canCreateThread: form.get("create") === "on", canReply: form.get("reply") === "on" });
    }
    await tx.insert(moderationActions).values({ actorId: access.user.id, action: `forum.configure.${data.kind}`, reason: "Administrator configuration", metadata: { id: data.id, slug: data.slug } }); return "Forum configuration saved.";
  }); revalidatePath("/", "layout"); return { message: result };
}
export async function removeForumRule(form: FormData) { const access = await requirePermission("admin.manage"); const id = z.coerce.number().int().positive().parse(form.get("id")); await withTransaction(async tx => { const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN"); await tx.delete(forumAccessRules).where(eq(forumAccessRules.id, id)); await tx.insert(moderationActions).values({ actorId: access.user.id, action: "forum.access.revoke", reason: "Administrator revoked forum access rule", metadata: { id } }); }); revalidatePath("/admin/forums"); }
