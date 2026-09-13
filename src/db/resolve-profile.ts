import { communityMemberFilter } from "@/lib/community-access";
import "server-only";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { findPublicProfile } from "@/db/queries/profile-queries";
import { availableForums } from "@/db/queries/community";
import {
  users,
  groups,
  userGroups,
  badges,
  userBadges,
  threads,
} from "@/db/schema";
import { requireMember } from "@/lib/session";
import type { ProfileSummary } from "@/lib/domain-types";
export async function resolvePublicProfile(
  username: string,
): Promise<ProfileSummary | null> {
  await requireMember();
  const database = createReadDatabase();
  const profile = await findPublicProfile(database, username);
  if (!profile || profile.accountStatus !== "active") return null;
  const [approved] = await database
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, profile.userId),
        communityMemberFilter(),
      ),
    )
    .limit(1);
  if (!approved) return null;
  const forumIds = (await availableForums()).map(({ forum }) => forum.id);
  const [groupRows, badgeRows, activity] = await Promise.all([
    database
      .select({ name: groups.name, description: groups.description })
      .from(userGroups)
      .innerJoin(groups, eq(groups.id, userGroups.groupId))
      .where(eq(userGroups.userId, profile.userId)),
    database
      .select({ name: badges.name })
      .from(userBadges)
      .innerJoin(badges, eq(badges.id, userBadges.badgeId))
      .where(eq(userBadges.userId, profile.userId)),
    forumIds.length
      ? database
          .select({
            id: threads.id,
            title: threads.title,
            slug: threads.slug,
            createdAt: threads.createdAt,
          })
          .from(threads)
          .where(
            and(
              eq(threads.creatorId, profile.userId),
              inArray(threads.forumId, forumIds),
              isNull(threads.deletedAt),
            ),
          )
          .orderBy(desc(threads.id))
          .limit(5)
      : [],
  ]);
  const handle = profile.username!;
  return {
    username: handle,
    displayName: profile.displayName || handle,
    tagline: "Community member",
    avatarSeed: handle,
    avatarUrl: profile.avatarUrl ?? undefined,
    initials: handle.slice(0, 2).toUpperCase(),
    joined: profile.joinedAt.toLocaleDateString("en-US", { timeZone: "UTC" }),
    lastSeen:
      profile.lastSeenAt?.toLocaleString("en-US", { timeZone: "UTC" }) ??
      "Not shared",
    uid: profile.userId,
    telegram: profile.telegramHandle ?? undefined,
    reputation: profile.reputation,
    vouches: {
      positive: profile.vouchPositive,
      neutral: profile.vouchNeutral,
      negative: profile.vouchNegative,
    },
    threads: profile.threadCount,
    posts: profile.postCount,
    likes: profile.likeCount,
    credits: profile.creditBalance,
    years: Math.floor((Date.now() - profile.joinedAt.getTime()) / 31557600000),
    badges: badgeRows.map((badge) => ({
      label: badge.name,
      icon: "BadgeCheck",
      tone: "cyan",
    })),
    groups: groupRows.map((group) => ({
      name: group.name,
      subtitle: group.description,
      tone: "cyan",
    })),
    activity: activity.map((thread) => ({
      title: thread.title,
      detail: thread.createdAt.toLocaleDateString("en-US", { timeZone: "UTC" }),
      href: `/threads/${thread.id}/${thread.slug}`,
    })),
    about: profile.bio,
    signature: profile.signature,
  };
}
