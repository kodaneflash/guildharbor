import "server-only";
import { viewerTimezone } from "@/lib/viewer-timezone";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { createReadDatabase } from "@/db/client";
import {
  categories,
  forums,
  threads,
  posts,
  profiles,
  users,
} from "@/db/schema";
import { canAccessForum, requireMember } from "@/lib/session";
import type { ForumCategory, ThreadListItem } from "@/lib/domain-types";

export async function availableForums(
  operation: "read" | "create" | "reply" = "read",
) {
  await requireMember();
  const rows = await createReadDatabase()
    .select({ forum: forums, category: categories })
    .from(forums)
    .innerJoin(categories, eq(categories.id, forums.categoryId))
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.position), asc(forums.position), asc(forums.id));
  const allowed = await Promise.all(
    rows.map((row) => canAccessForum(row.forum.id, operation)),
  );
  return rows.filter((_, index) => allowed[index]);
}
export async function forumCategories(): Promise<ForumCategory[]> {
  const rows = await availableForums();
  return [
    ...new Map(rows.map((row) => [row.category.id, row.category])).values(),
  ].map((category) => ({
    slug: category.slug,
    name: category.title,
    description: category.description,
    forums: rows
      .filter((row) => row.category.id === category.id)
      .map(({ forum }) => ({
        slug: forum.slug,
        name: forum.title,
        description: forum.description,
        icon: forum.icon ?? "MessagesSquare",
        accent: forum.color ?? "var(--category)",
        threadCount: forum.threadCount,
        postCount: forum.postCount,
      })),
  }));
}
export async function findForum(slug: string) {
  return (
    (await availableForums()).find((row) => row.forum.slug === slug)?.forum ??
    null
  );
}
export async function communityThreads(
  options: {
    forumId?: number;
    query?: string;
    creatorId?: string;
    page?: number;
  } = {},
): Promise<ThreadListItem[]> {
  await requireMember();
  const allowed = (await availableForums()).map((row) => row.forum.id);
  if (
    !allowed.length ||
    (options.forumId && !allowed.includes(options.forumId))
  )
    return [];
  const latestUser = alias(users, "latest_user");
  const query = options.query?.trim().slice(0, 200);
  const pattern = query ? `%${query.replace(/[\\%_]/g, "\\$&")}%` : undefined;
  const rows = await createReadDatabase()
    .select({
      thread: threads,
      forumSlug: forums.slug,
      username: users.username,
      avatarUrl: profiles.avatarUrl,
      latestUsername: latestUser.username,
    })
    .from(threads)
    .innerJoin(forums, eq(forums.id, threads.forumId))
    .innerJoin(users, eq(users.id, threads.creatorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(latestUser, eq(latestUser.id, threads.latestPosterId))
    .where(
      and(
        inArray(threads.forumId, allowed),
        options.forumId ? eq(threads.forumId, options.forumId) : undefined,
        options.creatorId
          ? eq(threads.creatorId, options.creatorId)
          : undefined,
        isNull(threads.deletedAt),
        ne(threads.status, "deleted"),
        pattern
          ? or(
              ilike(threads.title, pattern),
              sql`exists (select 1 from ${posts} where ${posts.threadId} = ${threads.id} and ${posts.deletedAt} is null and ${posts.plainText} ilike ${pattern})`,
            )
          : undefined,
      ),
    )
    .orderBy(
      desc(threads.isPinned),
      desc(threads.latestPostAt),
      desc(threads.id),
    )
    .limit(30)
    .offset(((options.page ?? 1) - 1) * 30);
  const timeZone = await viewerTimezone();
  return rows.map(
    ({ thread, forumSlug, username, avatarUrl, latestUsername }) => ({
      id: thread.id,
      slug: thread.slug,
      forumSlug,
      title: thread.title,
      type: thread.type,
      creator: username ?? "deleted",
      avatarSeed: username ?? "?",
      avatarUrl: avatarUrl ?? undefined,
      replies: thread.replyCount,
      views: thread.viewCount,
      latestReplyAt: thread.latestPostAt.toLocaleString("en-US", {
        timeZone,
      }),
      latestReplier: latestUsername ?? "deleted",
      isPinned: thread.isPinned,
      badges: thread.status === "locked" ? ["Locked"] : [],
    }),
  );
}
export async function findThread(id: number) {
  await requireMember();
  const database = createReadDatabase();
  const [thread] = await database
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.id, id),
        isNull(threads.deletedAt),
        ne(threads.status, "deleted"),
      ),
    )
    .limit(1);
  if (!thread || !(await canAccessForum(thread.forumId))) return null;
  return thread;
}
export async function threadPosts(threadId: number, page = 1) {
  if (!(await findThread(threadId))) return [];
  return createReadDatabase()
    .select({
      id: posts.id,
      content: posts.content,
      plainText: posts.plainText,
      authorId: posts.authorId,
      threadId: posts.threadId,
      updatedAt: posts.updatedAt,
      createdAt: posts.createdAt,
      editedAt: posts.editedAt,
      username: users.username,
      avatarUrl: profiles.avatarUrl,
      joinedAt: users.createdAt,
    })
    .from(posts)
    .innerJoin(users, eq(users.id, posts.authorId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(posts.threadId, threadId), isNull(posts.deletedAt)))
    .orderBy(asc(posts.id))
    .limit(30)
    .offset((page - 1) * 30);
}
export function pageNumber(value: string | undefined) {
  const page = Number(value ?? 1);
  return Number.isSafeInteger(page) && page > 0 && page <= 100000 ? page : 1;
}

/** Rank only readable forums, counting discussions that remain visible. */
export async function topSubforums() {
  const allowed = await availableForums();
  if (!allowed.length) return [];
  return createReadDatabase().select({
    id: forums.id, slug: forums.slug, title: forums.title,
    discussionCount: sql<number>`count(${threads.id})::int`,
  }).from(forums).innerJoin(threads, and(
    eq(threads.forumId, forums.id), isNull(threads.deletedAt), ne(threads.status, "deleted"),
  )).where(inArray(forums.id, allowed.map(({ forum }) => forum.id)))
    .groupBy(forums.id).orderBy(desc(sql`count(${threads.id})`), asc(forums.title), asc(forums.id)).limit(4);
}
