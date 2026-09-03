import "server-only";

import { asc, eq, isNull } from "drizzle-orm";

import type { ReadDatabase } from "@/db/client";
import { categories, forums } from "@/db/schema";

export async function listVisibleForums(database: ReadDatabase) {
  const categoryRows = await database
    .select({ id: categories.id, slug: categories.slug, title: categories.title, description: categories.description })
    .from(categories)
    .where(eq(categories.isVisible, true))
    .orderBy(asc(categories.position), asc(categories.id));

  const forumRows = await database
    .select({ id: forums.id, categoryId: forums.categoryId, slug: forums.slug, title: forums.title, description: forums.description, icon: forums.icon, color: forums.color, threadCount: forums.threadCount, postCount: forums.postCount, latestPostAt: forums.latestPostAt })
    .from(forums)
    .where(isNull(forums.parentForumId))
    .orderBy(asc(forums.position), asc(forums.id));

  return categoryRows.map((category) => ({
    ...category,
    forums: forumRows.filter((forum) => forum.categoryId === category.id),
  }));
}
