import "server-only";

import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import type { ReadDatabase } from "@/db/client";
import { threads, users } from "@/db/schema";

export type ThreadCursor = { latestPostAt: Date; id: number; isPinned: boolean };

export async function listForumThreads(database: ReadDatabase, forumId: number, cursor?: ThreadCursor, limit = 30) {
  const cursorPredicate = cursor
    ? or(
        lt(threads.isPinned, cursor.isPinned),
        and(eq(threads.isPinned, cursor.isPinned), lt(threads.latestPostAt, cursor.latestPostAt)),
        and(eq(threads.isPinned, cursor.isPinned), eq(threads.latestPostAt, cursor.latestPostAt), lt(threads.id, cursor.id)),
      )
    : undefined;

  return database
    .select({ id: threads.id, slug: threads.slug, title: threads.title, type: threads.type, status: threads.status, isPinned: threads.isPinned, replyCount: threads.replyCount, viewCount: threads.viewCount, latestPostAt: threads.latestPostAt, creator: users.displayUsername })
    .from(threads)
    .innerJoin(users, eq(users.id, threads.creatorId))
    .where(and(eq(threads.forumId, forumId), isNull(threads.deletedAt), cursorPredicate))
    .orderBy(desc(threads.isPinned), desc(threads.latestPostAt), desc(threads.id))
    .limit(Math.min(limit, 50));
}
