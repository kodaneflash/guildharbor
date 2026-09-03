import "server-only";

import { eq } from "drizzle-orm";

import type { ReadDatabase } from "@/db/client";
import { profiles, users } from "@/db/schema";

export async function findPublicProfile(database: ReadDatabase, username: string) {
  const [profile] = await database
    .select({ userId: users.id, username: users.username, displayUsername: users.displayUsername, accountStatus: users.accountStatus, displayName: profiles.displayName, avatarUrl: profiles.avatarUrl, bannerUrl: profiles.bannerUrl, telegramHandle: profiles.telegramHandle, bio: profiles.bio, reputation: profiles.reputation, vouchPositive: profiles.vouchPositive, vouchNeutral: profiles.vouchNeutral, vouchNegative: profiles.vouchNegative, threadCount: profiles.threadCount, postCount: profiles.postCount, likeCount: profiles.likeCount, creditBalance: profiles.creditBalance, joinedAt: profiles.joinedAt, lastSeenAt: profiles.lastSeenAt })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.username, username))
    .limit(1);

  return profile ?? null;
}
