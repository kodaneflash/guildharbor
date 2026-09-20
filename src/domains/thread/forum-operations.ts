import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { forums, moderationActions, postEditHistory, posts, profiles, reports, threads, threadSubscriptions } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { findThread } from "@/db/queries/community";
import { transactionForum } from "@/domains/authorization";
import { enforceRateLimit } from "@/lib/rate-limit";

export const forumOperationSchema = z.object({
  threadId: z.coerce.number().int().positive().safe(),
  postId: z.coerce.number().int().positive().safe().optional(),
  operation: z.enum(["edit", "delete", "subscribe", "unsubscribe", "report", "lock", "unlock", "pin", "unpin"]),
  text: z.string().trim().max(20000).default(""),
  reason: z.string().trim().max(2000).default(""),
  expectedUpdatedAt: z.iso.datetime().optional(),
}).superRefine((input, ctx) => {
  if (["edit", "delete", "report", "lock", "unlock", "pin", "unpin"].includes(input.operation) && input.reason.length < 5) ctx.addIssue({ code: "custom", path: ["reason"], message: "Provide a reason of at least five characters." });
  if (input.operation === "edit" && !input.text) ctx.addIssue({ code: "custom", path: ["text"], message: "Post content is required." });
  if (["edit", "delete"].includes(input.operation) && (!input.postId || !input.expectedUpdatedAt)) ctx.addIssue({ code: "custom", message: "Reload the post before editing." });
});
export async function operateForum(input: unknown) {
  const data = forumOperationSchema.parse(input);
  const access = await requireMember();
  await enforceRateLimit(data.operation === "report" ? "report" : "reply", access.user.id);
  return withTransaction(async database => {
    const [thread] = await database.select().from(threads).where(and(eq(threads.id, data.threadId), isNull(threads.deletedAt))).for("update");
    if (!thread || thread.status === "deleted") throw new Error("Thread unavailable");
    const actor = await transactionForum(database, access.user.id, thread.forumId);
    const moderator = actor.permissions.includes("admin.manage") || actor.permissions.includes("forum.moderate");
    const href = `/threads/${thread.id}/${thread.slug}`;
    if (data.operation === "subscribe") {
      await database.insert(threadSubscriptions).values({ userId: access.user.id, threadId: thread.id }).onConflictDoNothing();
    } else if (data.operation === "unsubscribe") {
      await database.delete(threadSubscriptions).where(and(eq(threadSubscriptions.userId, access.user.id), eq(threadSubscriptions.threadId, thread.id)));
    } else if (data.operation === "report") {
      if (!actor.permissions.includes("report.create") && !moderator) throw new Error("FORBIDDEN");
      if (data.postId) {
        const [target] = await database.select({ id: posts.id }).from(posts).where(and(eq(posts.id, data.postId), eq(posts.threadId, thread.id), isNull(posts.deletedAt)));
        if (!target) throw new Error("Post unavailable");
      }
      await database.insert(reports).values({ reporterId: access.user.id, targetPostId: data.postId, targetThreadId: data.postId ? undefined : thread.id, category: "community", reason: data.reason });
    } else if (["lock", "unlock", "pin", "unpin"].includes(data.operation)) {
      if (!moderator) throw new Error("FORBIDDEN");
      const change = data.operation === "lock" ? { status: "locked" as const } : data.operation === "unlock" ? { status: "open" as const } : { isPinned: data.operation === "pin" };
      await database.update(threads).set({ ...change, updatedAt: new Date() }).where(eq(threads.id, thread.id));
      await database.insert(moderationActions).values({ actorId: access.user.id, action: `thread.${data.operation}`, reason: data.reason, metadata: { threadId: thread.id } });
    } else {
      if (!data.postId) throw new Error("Post required");
      const [post] = await database.select().from(posts).where(and(eq(posts.id, data.postId), eq(posts.threadId, thread.id))).for("update");
      if (!post || post.deletedAt) throw new Error("Post unavailable");
      if (!moderator && (post.authorId !== access.user.id || !actor.permissions.includes("thread.edit.own") || thread.status !== "open")) throw new Error("FORBIDDEN");
      if (post.updatedAt.toISOString() !== data.expectedUpdatedAt) return { href, message: "This post changed. Reload before editing again." };
      const now = new Date();
      const content = { type: "doc", content: data.text.split("\n").map(text => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] })) };
      await database.insert(postEditHistory).values({ postId: post.id, editorId: access.user.id, previousContent: post.content, newContent: data.operation === "delete" ? post.content : content, reason: data.reason });
      if (data.operation === "edit") await database.update(posts).set({ content, plainText: data.text, editedAt: now, updatedAt: now }).where(eq(posts.id, post.id));
      else {
        await database.update(posts).set({ deletedAt: now, updatedAt: now }).where(eq(posts.id, post.id));
        const [latest] = await database.select().from(posts).where(and(eq(posts.threadId, thread.id), isNull(posts.deletedAt))).orderBy(desc(posts.id)).limit(1);
        const [count] = await database.select({ value: sql<number>`count(*)::int` }).from(posts).where(and(eq(posts.threadId, thread.id), isNull(posts.deletedAt)));
        await database.update(threads).set({ replyCount: Math.max(0, count.value - 1), deletedAt: latest ? null : now, latestPostId: latest?.id ?? null, latestPosterId: latest?.authorId ?? null, latestPostAt: latest?.createdAt ?? thread.createdAt, updatedAt: now }).where(eq(threads.id, thread.id));
        await database.update(profiles).set({ postCount: sql`greatest(0, ${profiles.postCount} - 1)` }).where(eq(profiles.userId, post.authorId));
        if (!latest) await database.update(profiles).set({ threadCount: sql`greatest(0, ${profiles.threadCount} - 1)` }).where(eq(profiles.userId, thread.creatorId));
        const [latestThread] = await database.select().from(threads).where(and(eq(threads.forumId, thread.forumId), isNull(threads.deletedAt))).orderBy(desc(threads.latestPostAt), desc(threads.id)).limit(1);
        await database.update(forums).set({ postCount: sql`greatest(0, ${forums.postCount} - 1)`, threadCount: latest ? sql`${forums.threadCount}` : sql`greatest(0, ${forums.threadCount} - 1)`, latestThreadId: latestThread?.id ?? null, latestPostAt: latestThread?.latestPostAt ?? null }).where(eq(forums.id, thread.forumId));
      }
      await database.insert(moderationActions).values({ actorId: access.user.id, subjectUserId: post.authorId, action: `post.${data.operation}`, reason: data.reason, metadata: { threadId: thread.id, postId: post.id } });
    }
    return { href, message: data.operation === "report" ? "Report submitted for staff review." : "Changes saved." };
  });
}
export async function postHistory(postId: number) {
  const access = await requireMember();
  const database = createReadDatabase();
  const [post] = await database.select().from(posts).where(eq(posts.id, postId));
  if (!post || !(await findThread(post.threadId))) return null;
  if (post.authorId !== access.user.id && !access.permissions.some(permission => ["admin.manage", "forum.moderate"].includes(permission))) throw new Error("FORBIDDEN");
  return database.select().from(postEditHistory).where(eq(postEditHistory.postId, postId)).orderBy(asc(postEditHistory.id)).limit(100);
}
