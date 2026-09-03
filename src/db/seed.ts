import { and, count, eq, sql } from "drizzle-orm";

import { createReadDatabase, type ReadDatabase } from "@/db/client";
import {
  categories,
  forums,
  marketplaceListings,
  posts,
  profiles,
  reputationEvents,
  roles,
  threads,
  userRoles,
  users,
  vouches,
} from "@/db/schema";
import type { DemoCommunityMember } from "@/data/demo-community";
import { loadScrapedDemoMembers } from "@/db/load-scraped-demo-members";

const reputationReason = "GuildHarbor demo reputation snapshot";
const vouchComment = "GuildHarbor demo vouch snapshot";
const insertBatchSize = 500;

function slugify(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function insertMissingReputation(
  database: ReadDatabase,
  member: DemoCommunityMember,
  giverId: string,
) {
  const [existing] = await database
    .select({ value: count() })
    .from(reputationEvents)
    .where(and(
      eq(reputationEvents.recipientId, member.id),
      eq(reputationEvents.reason, reputationReason),
    ));
  const missing = Math.max(0, member.reputation - existing.value);

  for (let offset = 0; offset < missing; offset += insertBatchSize) {
    const size = Math.min(insertBatchSize, missing - offset);
    await database.insert(reputationEvents).values(
      Array.from({ length: size }, (_, index) => ({
        giverId,
        recipientId: member.id,
        value: 1,
        reason: reputationReason,
        createdAt: new Date(Date.UTC(2024, 0, 1 + ((offset + index) % 300))),
      })),
    );
  }
}

async function insertMissingVouches(
  database: ReadDatabase,
  member: DemoCommunityMember,
  authorId: string,
) {
  const [existing] = await database
    .select({ value: count() })
    .from(vouches)
    .where(and(
      eq(vouches.recipientId, member.id),
      eq(vouches.comment, vouchComment),
    ));
  const missing = Math.max(0, member.vouches - existing.value);

  for (let offset = 0; offset < missing; offset += insertBatchSize) {
    const size = Math.min(insertBatchSize, missing - offset);
    await database.insert(vouches).values(
      Array.from({ length: size }, (_, index) => ({
        authorId,
        recipientId: member.id,
        rating: "positive" as const,
        comment: vouchComment,
        status: "actioned" as const,
        createdAt: new Date(Date.UTC(2024, 0, 1 + ((offset + index) % 300))),
      })),
    );
  }
}

async function seedDemoCommunity(
  database: ReadDatabase,
  memberRoleId: string,
  members: DemoCommunityMember[],
) {
  const forumRows = await database
    .select({ id: forums.id, slug: forums.slug })
    .from(forums);
  const forumIds = new Map(forumRows.map((forum) => [forum.slug, forum.id]));

  for (const member of members) {
    await database.insert(users).values({
      id: member.id,
      name: member.displayName,
      email: `${member.username.toLocaleLowerCase()}@demo.guildharbor.invalid`,
      emailVerified: true,
      image: member.avatarUrl,
      username: member.username.toLocaleLowerCase(),
      displayUsername: member.username,
      accountStatus: "active",
      createdAt: new Date(`${member.joinedAt}T00:00:00Z`),
    }).onConflictDoUpdate({
      target: users.id,
      set: {
        name: member.displayName,
        image: member.avatarUrl,
        username: member.username.toLocaleLowerCase(),
        displayUsername: member.username,
        accountStatus: "active",
      },
    });

    await database.insert(profiles).values({
      userId: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      bio: member.thread.summary,
      primaryRoleId: memberRoleId,
      reputation: member.reputation,
      vouchPositive: member.vouches,
      threadCount: member.sourceThreadCount,
      postCount: member.sourcePostCount,
      likeCount: member.likes,
      creditBalance: member.credits,
      joinedAt: new Date(`${member.joinedAt}T00:00:00Z`),
    }).onConflictDoUpdate({
      target: profiles.userId,
      set: {
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        bio: member.thread.summary,
        primaryRoleId: memberRoleId,
        reputation: member.reputation,
        vouchPositive: member.vouches,
        threadCount: member.sourceThreadCount,
        postCount: member.sourcePostCount,
        likeCount: member.likes,
        creditBalance: member.credits,
        joinedAt: new Date(`${member.joinedAt}T00:00:00Z`),
      },
    });

    await database.insert(userRoles).values({
      userId: member.id,
      roleId: memberRoleId,
    }).onConflictDoNothing();

    const forumId = forumIds.get(member.thread.forumSlug);
    if (!forumId) throw new Error(`Missing forum ${member.thread.forumSlug}`);
    const threadSlug = slugify(member.thread.title);
    const [existingThread] = await database
      .select({ id: threads.id })
      .from(threads)
      .where(and(
        eq(threads.creatorId, member.id),
        eq(threads.slug, threadSlug),
      ))
      .limit(1);

    const threadId = existingThread?.id ?? (
      await database.insert(threads).values({
        forumId,
        creatorId: member.id,
        latestPosterId: member.id,
        slug: threadSlug,
        title: member.thread.title,
        type: member.thread.type,
        status: "open",
        isPinned: member.username === "Northstar" || member.username === "Meridian",
        viewCount: Math.max(120, member.sourcePostCount * 3),
        latestPostAt: new Date(),
      }).returning({ id: threads.id })
    )[0].id;

    const [existingPost] = await database
      .select({ id: posts.id })
      .from(posts)
      .where(and(eq(posts.threadId, threadId), eq(posts.authorId, member.id)))
      .limit(1);
    const postId = existingPost?.id ?? (
      await database.insert(posts).values({
        threadId,
        authorId: member.id,
        content: {
          type: "doc",
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: member.thread.summary }],
          }],
        },
        plainText: member.thread.summary,
      }).returning({ id: posts.id })
    )[0].id;

    await database.update(threads).set({
      latestPostId: postId,
      latestPosterId: member.id,
      latestPostAt: new Date(),
    }).where(eq(threads.id, threadId));

    if (member.thread.type === "selling" || member.thread.type === "service") {
      await database.insert(marketplaceListings).values({
        threadId,
        status: "active",
        category: member.thread.forumSlug,
        fulfillment: "Digital delivery after written scope confirmation",
        condition: "Original or properly licensed work",
        lawfulAttestation: true,
        searchText: `${member.thread.title} ${member.thread.summary}`,
      }).onConflictDoUpdate({
        target: marketplaceListings.threadId,
        set: {
          status: "active",
          category: member.thread.forumSlug,
          fulfillment: "Digital delivery after written scope confirmation",
          condition: "Original or properly licensed work",
          lawfulAttestation: true,
          searchText: `${member.thread.title} ${member.thread.summary}`,
        },
      });
    }
  }

  for (const [index, member] of members.entries()) {
    const feedbackAuthor = members[
      (index + 1) % members.length
    ];
    await insertMissingReputation(database, member, feedbackAuthor.id);
    await insertMissingVouches(database, member, feedbackAuthor.id);
  }

  for (const forumId of forumIds.values()) {
    await database.update(forums).set({
      threadCount: sql<number>`(
        select count(*)::integer from ${threads}
        where ${threads.forumId} = ${forumId} and ${threads.deletedAt} is null
      )`,
      postCount: sql<number>`(
        select count(*)::integer from ${posts}
        inner join ${threads} on ${posts.threadId} = ${threads.id}
        where ${threads.forumId} = ${forumId} and ${posts.deletedAt} is null
      )`,
    }).where(eq(forums.id, forumId));
  }
}

async function seed() {
  const database = createReadDatabase();
  await database.insert(roles).values([
    { key: "member", name: "Member", permissions: ["forum.read", "thread.create", "thread.reply", "thread.edit.own", "message.send", "report.create"] },
    { key: "moderator", name: "Moderator", permissions: ["forum.read", "thread.moderate", "moderation.review"] },
    { key: "administrator", name: "Administrator", permissions: ["admin.manage"] },
  ]).onConflictDoNothing();

  const insertedCategories = await database.insert(categories).values([
    { slug: "community", title: "Community", description: "Announcements, conversation, and member support.", position: 10 },
    { slug: "marketplace", title: "Lawful Marketplace", description: "Licensed goods, domains, and professional services.", position: 20 },
  ]).onConflictDoNothing().returning({ id: categories.id, slug: categories.slug });
  const categoryRows = insertedCategories.length ? insertedCategories : await database.select({ id: categories.id, slug: categories.slug }).from(categories);
  const communityId = categoryRows.find((category) => category.slug === "community")?.id;
  const marketplaceId = categoryRows.find((category) => category.slug === "marketplace")?.id;
  if (!communityId || !marketplaceId) throw new Error("Unable to resolve seed categories");
  await database.insert(forums).values([
    { categoryId: communityId, slug: "announcements", title: "Announcements", description: "Platform news, policy updates, and important notices.", icon: "Megaphone", color: "#50cd89", position: 10 },
    { categoryId: communityId, slug: "general", title: "General Discussion", description: "Talk shop, share projects, and meet the community.", icon: "MessagesSquare", color: "#61b6cd", position: 20 },
    { categoryId: communityId, slug: "support", title: "Help & Safety", description: "Account help, marketplace safety, and policy questions.", icon: "LifeBuoy", color: "#ffd05f", position: 30 },
    { categoryId: marketplaceId, slug: "digital-goods", title: "Original Digital Goods", description: "Templates, audio, art, code, and licensed work.", icon: "PackageOpen", color: "#03ffed", position: 10 },
    { categoryId: marketplaceId, slug: "domains", title: "Domains", description: "Lawfully owned domain names with documented transfer.", icon: "Globe2", color: "#2196f3", position: 20 },
    { categoryId: marketplaceId, slug: "services", title: "Professional Services", description: "Development, design, writing, audits, and consulting.", icon: "BriefcaseBusiness", color: "#e2a03f", position: 30 },
  ]).onConflictDoNothing();

  const [memberRole] = await database
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.key, "member"))
    .limit(1);
  if (!memberRole) throw new Error("Unable to resolve member role");
  const seededMembers = await loadScrapedDemoMembers();
  await seedDemoCommunity(database, memberRole.id, seededMembers);
}

seed().then(() => process.exit(0)).catch((error: Error) => { console.error(error.message); process.exit(1); });
