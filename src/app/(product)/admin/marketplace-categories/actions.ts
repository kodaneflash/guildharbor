"use server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTransaction } from "@/db/transaction";
import { domainAuditEvents, listings, marketplaceCategories, sellerProfiles } from "@/db/schema";
import { requirePermission } from "@/lib/session";
import { transactionActor } from "@/domains/authorization";
const categoryInput = z.object({ id: z.union([z.uuid(), z.literal("")]).optional(), name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80), parentId: z.union([z.uuid(), z.literal("")]), operation: z.enum(["save", "archive", "restore"]) });
export async function categoryAction(_: { message: string }, form: FormData) {
  const access = await requirePermission("admin.manage"); const parsed = categoryInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Provide a name, a lowercase hyphenated slug and a valid parent category." };
  const data = parsed.data;
  const result = await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    await tx.execute(sql`select pg_advisory_xact_lock(714082916)`);
    const all = await tx.select().from(marketplaceCategories).for("update");
    if (data.id && !all.some(category => category.id === data.id)) return "Category unavailable.";
    if (all.some(category => category.slug === data.slug && category.id !== data.id)) return "That category slug is already used.";
    let parent = data.parentId || null; const visited = new Set<string>();
    while (parent) {
      if (parent === data.id || visited.has(parent)) return "Category hierarchies cannot contain cycles.";
      visited.add(parent); const category = all.find(category => category.id === parent);
      if (!category || category.archivedAt) return "Choose an active parent category.";
      parent = category.parentId;
    }
    const values = { name: data.name, slug: data.slug, parentId: data.parentId || null, archivedAt: data.operation === "archive" ? new Date() : null, updatedAt: new Date() };
    const [category] = data.id ? await tx.update(marketplaceCategories).set(values).where(eq(marketplaceCategories.id, data.id)).returning() : await tx.insert(marketplaceCategories).values(values).returning();
    if (data.operation === "archive") {
      await tx.update(listings).set({ categoryId: null }).where(eq(listings.categoryId, category.id));
      await tx.update(marketplaceCategories).set({ parentId: category.parentId }).where(eq(marketplaceCategories.parentId, category.id));
    }
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "category", resourceId: category.id, action: `category.${data.operation}`, reason: "Administrator taxonomy configuration" });
    return "Category saved. Listings are never deleted when a category is archived.";
  });
  revalidatePath("/admin/marketplace-categories"); revalidatePath("/marketplace"); revalidatePath("/"); return { message: result };
}
export async function commerceModerationAction(_: { message: string }, form: FormData) {
  const access = await requirePermission("admin.manage");
  const parsed = z.object({ id: z.string().min(1), kind: z.enum(["listing", "seller"]), operation: z.enum(["remove", "restore", "suspend"]), reason: z.string().trim().min(5).max(2000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { message: "Provide a valid target and a reason of 5–2,000 characters." };
  const data = parsed.data;
  await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    if (data.kind === "listing") {
      z.uuid().parse(data.id); if (data.operation === "suspend") throw new Error("Invalid listing operation");
      const updated = await tx.update(listings).set({ status: data.operation === "remove" ? "removed" : "draft", updatedAt: new Date() }).where(and(eq(listings.id, data.id), data.operation === "restore" ? eq(listings.status, "removed") : undefined)).returning({ id: listings.id });
      if (!updated.length) throw new Error("Listing unavailable or state changed");
    } else {
      if (data.operation === "remove") throw new Error("Invalid seller operation");
      const updated = await tx.update(sellerProfiles).set({ status: data.operation === "suspend" ? "suspended" : "active", updatedAt: new Date() }).where(eq(sellerProfiles.userId, data.id)).returning({ id: sellerProfiles.userId });
      if (!updated.length) throw new Error("Seller unavailable");
    }
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: data.kind, resourceId: data.id, action: `${data.kind}.${data.operation}`, reason: data.reason });
  });
  revalidatePath("/", "layout"); return { message: "Moderation decision recorded. Restored listings require seller publication." };
}
