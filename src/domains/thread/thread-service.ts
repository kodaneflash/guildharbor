import "server-only";

import { eq, sql } from "drizzle-orm";

import { forums, posts, profiles, threads } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { extractPlainText, type RichTextDocument } from "@/lib/rich-text";

type CreateThreadInput = { actorId: string; forumId: number; title: string; type: "discussion" | "selling" | "buying" | "service" | "announcement"; content: RichTextDocument };
function slugify(value: string) { return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "thread"; }

export async function createThread(input: CreateThreadInput) {
  return withTransaction(async (database) => {
    const [thread] = await database.insert(threads).values({ forumId: input.forumId, creatorId: input.actorId, title: input.title, slug: slugify(input.title), type: input.type, latestPosterId: input.actorId }).returning({ id: threads.id, slug: threads.slug });
    const [post] = await database.insert(posts).values({ threadId: thread.id, authorId: input.actorId, content: input.content, plainText: extractPlainText(input.content) }).returning({ id: posts.id, createdAt: posts.createdAt });
    await database.update(threads).set({ latestPostId: post.id, latestPostAt: post.createdAt }).where(eq(threads.id, thread.id));
    await database.update(forums).set({ threadCount: sql`${forums.threadCount} + 1`, postCount: sql`${forums.postCount} + 1`, latestThreadId: thread.id, latestPostAt: post.createdAt }).where(eq(forums.id, input.forumId));
    await database.update(profiles).set({ threadCount: sql`${profiles.threadCount} + 1`, postCount: sql`${profiles.postCount} + 1` }).where(eq(profiles.userId, input.actorId));
    return thread;
  });
}
