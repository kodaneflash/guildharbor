import { hasCommunityAccess } from "@/lib/community-access";
import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import { forums, posts, profiles, threads, users } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { findThread } from "@/db/queries/community";
import { requireMember, requireForum } from "@/lib/session";
import { threadInputSchema } from "@/lib/validation";
import {
  extractPlainText,
  richTextDocumentSchema,
  type RichTextDocument,
} from "@/lib/rich-text";

type CreateThreadInput = {
  actorId: string;
  forumId: number;
  title: string;
  type: "discussion" | "announcement";
  content: RichTextDocument;
};
function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "thread"
  );
}

export async function createThread(input: CreateThreadInput) {
  const access = await requireMember();
  if (access.user.id !== input.actorId) throw new Error("FORBIDDEN");
  await requireForum(input.forumId, "create");
  if (
    input.type === "announcement" &&
    !access.permissions.includes("admin.manage")
  )
    throw new Error("FORBIDDEN");
  threadInputSchema.parse({
    forumId: input.forumId,
    title: input.title,
    type: input.type,
    content: input.content,
  });
  richTextDocumentSchema.parse(input.content);
  if (!extractPlainText(input.content).length)
    throw new Error("Post content is required");
  return withTransaction(async (database) => {
    const [actor] = await database
      .select()
      .from(users)
      .where(eq(users.id, input.actorId))
      .for("share");
    if (
      !hasCommunityAccess(actor ?? null)
    )
      throw new Error("FORBIDDEN");
    const [thread] = await database
      .insert(threads)
      .values({
        forumId: input.forumId,
        creatorId: input.actorId,
        title: input.title,
        slug: slugify(input.title),
        type: input.type,
        latestPosterId: input.actorId,
      })
      .returning({ id: threads.id, slug: threads.slug });
    const [post] = await database
      .insert(posts)
      .values({
        threadId: thread.id,
        authorId: input.actorId,
        content: input.content,
        plainText: extractPlainText(input.content),
      })
      .returning({ id: posts.id, createdAt: posts.createdAt });
    await database
      .update(threads)
      .set({ latestPostId: post.id, latestPostAt: post.createdAt })
      .where(eq(threads.id, thread.id));
    await database
      .update(forums)
      .set({
        threadCount: sql`${forums.threadCount} + 1`,
        postCount: sql`${forums.postCount} + 1`,
        latestThreadId: thread.id,
        latestPostAt: post.createdAt,
      })
      .where(eq(forums.id, input.forumId));
    await database
      .update(profiles)
      .set({
        threadCount: sql`${profiles.threadCount} + 1`,
        postCount: sql`${profiles.postCount} + 1`,
      })
      .where(eq(profiles.userId, input.actorId));
    return thread;
  });
}

export async function replyToThread(threadId: number, text: string) {
  const access = await requireMember();
  const content = text.trim();
  if (!content || content.length > 20000)
    throw new Error("Reply must contain 1–20,000 characters.");
  const target = await findThread(threadId);
  if (!target) throw new Error("Thread is unavailable.");
  await requireForum(target.forumId, "reply");
  return withTransaction(async (database) => {
    const [thread] = await database
      .select()
      .from(threads)
      .where(and(eq(threads.id, threadId), isNull(threads.deletedAt)))
      .for("update");
    if (
      !thread ||
      thread.status !== "open" ||
      thread.forumId !== target.forumId
    )
      throw new Error("Thread is closed or unavailable.");
    const [actor] = await database
      .select()
      .from(users)
      .where(eq(users.id, access.user.id))
      .for("share");
    if (
      !hasCommunityAccess(actor ?? null)
    )
      throw new Error("FORBIDDEN");
    const [post] = await database
      .insert(posts)
      .values({
        threadId,
        authorId: access.user.id,
        plainText: content,
        content: {
          type: "doc",
          content: content
            .split("\n")
            .map((line) => ({
              type: "paragraph",
              content: line ? [{ type: "text", text: line }] : [],
            })),
        },
      })
      .returning({ id: posts.id, createdAt: posts.createdAt });
    await database
      .update(threads)
      .set({
        replyCount: sql`${threads.replyCount} + 1`,
        latestPostAt: post.createdAt,
        latestPostId: post.id,
        latestPosterId: access.user.id,
      })
      .where(eq(threads.id, threadId));
    await database
      .update(forums)
      .set({
        postCount: sql`${forums.postCount} + 1`,
        latestThreadId: threadId,
        latestPostAt: post.createdAt,
      })
      .where(eq(forums.id, thread.forumId));
    await database
      .update(profiles)
      .set({ postCount: sql`${profiles.postCount} + 1` })
      .where(eq(profiles.userId, access.user.id));
    return {
      id: post.id,
      slug: thread.slug,
      page: Math.floor((thread.replyCount + 1) / 30) + 1,
    };
  });
}
