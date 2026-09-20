"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTransaction } from "@/db/transaction";
import { moderationActions, reports } from "@/db/schema";
import { transactionActor, transactionForum } from "@/domains/authorization";
import { requirePermission } from "@/lib/session";
import { findThread } from "@/db/queries/community";
import { createReadDatabase } from "@/db/client";
import { posts } from "@/db/schema";
const inputSchema = z.object({ reportId: z.coerce.number().int().positive(), status: z.enum(["triaged", "actioned", "dismissed"]), reason: z.string().trim().min(5).max(2000) });
export async function resolveReport(_: { message: string }, form: FormData) {
  const access = await requirePermission("moderation.review");
  const input = inputSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { message: "Choose a decision and provide a reason of 5–2,000 characters." };
  const database = createReadDatabase();
  const [report] = await database.select().from(reports).where(eq(reports.id, input.data.reportId));
  if (!report || report.targetMessageId || report.targetUserId) return { message: "This report requires the corresponding scoped moderation workflow." };
  const [post] = report.targetPostId ? await database.select().from(posts).where(eq(posts.id, report.targetPostId)) : [];
  const thread = await findThread(report.targetThreadId ?? post?.threadId ?? 0);
  if (!thread) return { message: "The report context is unavailable to your account." };
  await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id);
    if (!actor.permissions.some(permission => ["admin.manage", "moderation.review"].includes(permission))) throw new Error("FORBIDDEN");
    await transactionForum(tx, access.user.id, thread.forumId);
    const [current] = await tx.select().from(reports).where(eq(reports.id, report.id)).for("update");
    if (!current || !["open", "triaged"].includes(current.status)) throw new Error("Report already resolved. Reload the queue.");
    await tx.update(reports).set({ status: input.data.status, updatedAt: new Date() }).where(eq(reports.id, report.id));
    await tx.insert(moderationActions).values({ actorId: access.user.id, reportId: report.id, action: `report.${input.data.status}`, reason: input.data.reason });
  });
  revalidatePath("/moderation/reports");
  return { message: "Report decision recorded." };
}
