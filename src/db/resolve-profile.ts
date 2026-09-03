import "server-only";

import type { ProfileSummary } from "@/lib/domain-types";
import { createReadDatabase } from "@/db/client";
import { findPublicProfile } from "@/db/queries/profile-queries";
import {
  findDemoCommunityMember,
  profileFromDemoMember,
} from "@/data/demo-community";
import { demoProfile } from "@/data/demo";
import { isDatabaseConfigured } from "@/lib/env";

function summaryFromDatabase(
  profile: NonNullable<Awaited<ReturnType<typeof findPublicProfile>>>,
): ProfileSummary {
  const username = profile.displayUsername ?? profile.username ?? "Member";
  const joinedAt = profile.joinedAt;
  const years = Math.max(
    1,
    new Date().getUTCFullYear() - joinedAt.getUTCFullYear(),
  );

  return {
    username,
    displayName: profile.displayName ?? username,
    tagline: "GuildHarbor demo community member",
    avatarSeed: username.slice(0, 2),
    avatarUrl: profile.avatarUrl ?? undefined,
    initials: username.slice(0, 2).toUpperCase(),
    joined: joinedAt.toLocaleDateString("en-US", { timeZone: "UTC" }),
    lastSeen: profile.lastSeenAt ? "Seen recently" : "Last seen hidden",
    uid: profile.userId.replace("demo-member-", "").toUpperCase(),
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
    years,
    badges: [
      { label: "Community member", icon: "BadgeCheck", tone: "cyan" },
      { label: "Contributor", icon: "HeartHandshake", tone: "trust" },
    ],
    groups: [
      {
        name: "Member",
        subtitle: "GuildHarbor community participant",
        tone: "cyan",
      },
    ],
    listings: [],
    activity: [
      {
        title: "View public threads",
        detail: "Recent activity",
        href: `/members/${username}/threads`,
      },
    ],
    about: profile.bio,
    signature: "Clear terms, original work, and respectful collaboration.",
  };
}

export async function resolvePublicProfile(username: string) {
  if (username.toLocaleLowerCase() === demoProfile.username.toLocaleLowerCase()) {
    return demoProfile;
  }

  const fixtureMember = findDemoCommunityMember(username);
  if (fixtureMember) return profileFromDemoMember(fixtureMember);
  if (!isDatabaseConfigured) return null;

  const profile = await findPublicProfile(createReadDatabase(), username);
  if (!profile || profile.accountStatus !== "active") return null;
  return summaryFromDatabase(profile);
}
