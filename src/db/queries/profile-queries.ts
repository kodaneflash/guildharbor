import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { ReadDatabase } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { communityMemberFilter } from "@/lib/community-access";
import { availableForums } from "./community";

export async function findPublicProfile(database: ReadDatabase, username: string) {
  await requireMember();
  const ids = (await availableForums()).map(({ forum }) => forum.id);
  const visible = ids.length ? sql`t.forum_id in (${sql.join(ids.map(id => sql`${id}`), sql`, `)})` : sql`false`;
  const [profile] = await database.select({
    userId: users.id, username: users.username, accountStatus: users.accountStatus,
    displayName: profiles.displayName, avatarUrl: profiles.avatarUrl,
    telegramHandle: sql<string | null>`case when ${profiles.showTelegram} then ${profiles.telegramHandle} else null end`,
    discordHandle: sql<string | null>`case when ${profiles.showDiscord} then ${profiles.discordHandle} else null end`,
    bio: profiles.bio, signature: profiles.signature, joinedAt: profiles.joinedAt,
    lastSeenAt: sql<string | null>`case when ${profiles.showLastSeen} then ${profiles.lastSeenAt}::text else null end`,
    threadCount: sql<number>`(select count(*)::int from threads t where t.creator_id = ${users.id} and t.deleted_at is null and t.status <> 'deleted' and ${visible})`,
    postCount: sql<number>`(select count(*)::int from posts p join threads t on t.id = p.thread_id where p.author_id = ${users.id} and p.deleted_at is null and t.deleted_at is null and t.status <> 'deleted' and ${visible})`,
    reputation: sql<number>`(select coalesce(sum(r.value),0)::int from reputation_events r join threads t on t.id = r.thread_id where r.recipient_id = ${users.id} and t.deleted_at is null and t.status <> 'deleted' and ${visible})`,
    vouchPositive: sql<number>`(select count(*)::int from vouches v join threads t on t.id = v.thread_id where v.recipient_id = ${users.id} and v.status = 'actioned' and v.rating = 'positive' and t.deleted_at is null and ${visible})`,
    vouchNeutral: sql<number>`(select count(*)::int from vouches v join threads t on t.id = v.thread_id where v.recipient_id = ${users.id} and v.status = 'actioned' and v.rating = 'neutral' and t.deleted_at is null and ${visible})`,
    vouchNegative: sql<number>`(select count(*)::int from vouches v join threads t on t.id = v.thread_id where v.recipient_id = ${users.id} and v.status = 'actioned' and v.rating = 'negative' and t.deleted_at is null and ${visible})`,
  }).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(users.username, username), communityMemberFilter())).limit(1);
  return profile ?? null;
}
