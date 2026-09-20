import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  },
});

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

const createdAt = timestamp("created_at", { withTimezone: true })
  .defaultNow()
  .notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true })
  .defaultNow()
  .$onUpdate(() => new Date())
  .notNull();

export const accountStatusEnum = pgEnum("account_status", [
  "pending_email",
  "pending_username",
  "active",
  "restricted",
  "suspended",
  "banned",
  "deleted",
]);
export const threadTypeEnum = pgEnum("thread_type", [
  "discussion",
  "announcement",
]);
export const threadStatusEnum = pgEnum("thread_status", [
  "open",
  "locked",
  "archived",
  "deleted",
]);
export const vouchRatingEnum = pgEnum("vouch_rating", [
  "positive",
  "neutral",
  "negative",
]);
export const moderationStatusEnum = pgEnum("moderation_status", [
  "open",
  "triaged",
  "actioned",
  "dismissed",
]);
export const attachmentStateEnum = pgEnum("attachment_state", [
  "pending",
  "ready",
  "rejected",
  "deleted",
]);
export const conversationTypeEnum = pgEnum("conversation_type", [
  "direct",
  "group",
  "deal",
  "order",
]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: citext("email").notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    username: citext("username"),
    displayUsername: text("display_username"),
    twoFactorEnabled: boolean("two_factor_enabled").default(false),
    membershipStatus: text("membership_status").default("pending").notNull(),
    accountStatus: accountStatusEnum("account_status")
      .default("pending_email")
      .notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    check(
      "users_membership_status_valid",
      sql`${table.membershipStatus} in ('pending', 'approved', 'rejected')`,
    ),
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique")
      .on(table.username)
      .where(sql`${table.username} is not null`),
    index("users_username_trgm_idx").using(
      "gin",
      table.username.op("gin_trgm_ops"),
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull(),
    createdAt,
    updatedAt,
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("sessions_token_unique").on(table.token),
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("accounts_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("verifications_identifier_idx").on(table.identifier),
    index("verifications_expires_at_idx").on(table.expiresAt),
  ],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").default(false).notNull(),
    failedVerificationCount: integer("failed_verification_count")
      .default(0)
      .notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (table) => [uniqueIndex("two_factors_user_unique").on(table.userId)],
);

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  permissions: text("permissions")
    .array()
    .default(sql`'{}'::text[]`)
    .notNull(),
  color: text("color"),
  createdAt,
  updatedAt,
});

export const profiles = pgTable(
  "profiles",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    telegramHandle: text("telegram_handle"),
    discordHandle: text("discord_handle"),
    showTelegram: boolean("show_telegram").default(false).notNull(),
    showDiscord: boolean("show_discord").default(false).notNull(),
    showLastSeen: boolean("show_last_seen").default(false).notNull(),
    preferredContact: text("preferred_contact").default("any").notNull(),
    locale: text("locale").default("en").notNull(),
    timezone: text("timezone").default("UTC").notNull(),
    bio: text("bio").default("").notNull(),
    signature: jsonb("signature")
      .default({ type: "doc", content: [] })
      .notNull(),
    primaryRoleId: uuid("primary_role_id").references(() => roles.id),
    reputation: integer("reputation").default(0).notNull(),
    vouchPositive: integer("vouch_positive").default(0).notNull(),
    vouchNeutral: integer("vouch_neutral").default(0).notNull(),
    vouchNegative: integer("vouch_negative").default(0).notNull(),
    threadCount: integer("thread_count").default(0).notNull(),
    postCount: integer("post_count").default(0).notNull(),
    likeCount: integer("like_count").default(0).notNull(),
    creditBalance: integer("credit_balance").default(0).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    updatedAt,
  },
  (table) => [
    check("profiles_locale_valid", sql`${table.locale} = 'en'`),
    check("profiles_preferred_contact_valid", sql`${table.preferredContact} in ('email', 'telegram', 'discord', 'any')`),
    check("profiles_contact_configured", sql`(${table.preferredContact} <> 'telegram' or nullif(${table.telegramHandle}, '') is not null) and (${table.preferredContact} <> 'discord' or nullif(${table.discordHandle}, '') is not null)`),
    check("profiles_reputation_nonnegative", sql`${table.reputation} >= 0`),
    check(
      "profiles_vouch_positive_nonnegative",
      sql`${table.vouchPositive} >= 0`,
    ),
    check(
      "profiles_vouch_neutral_nonnegative",
      sql`${table.vouchNeutral} >= 0`,
    ),
    check(
      "profiles_vouch_negative_nonnegative",
      sql`${table.vouchNegative} >= 0`,
    ),
    check("profiles_threads_nonnegative", sql`${table.threadCount} >= 0`),
    check("profiles_posts_nonnegative", sql`${table.postCount} >= 0`),
    check("profiles_likes_nonnegative", sql`${table.likeCount} >= 0`),
    check("profiles_credits_nonnegative", sql`${table.creditBalance} >= 0`),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    roleId: uuid("role_id")
      .references(() => roles.id, { onDelete: "cascade" })
      .notNull(),
    grantedById: text("granted_by_id").references(() => users.id),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
);

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default("").notNull(),
  imageUrl: text("image_url"),
  color: text("color"),
  createdAt,
  updatedAt,
});

export const userGroups = pgTable(
  "user_groups",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    groupId: uuid("group_id")
      .references(() => groups.id, { onDelete: "cascade" })
      .notNull(),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.groupId] })],
);

export const usernameHistory = pgTable(
  "username_history",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    oldUsername: citext("old_username").notNull(),
    newUsername: citext("new_username").notNull(),
    changedById: text("changed_by_id").references(() => users.id),
    createdAt,
  },
  (table) => [index("username_history_user_idx").on(table.userId, table.id)],
);

export const categories = pgTable("categories", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").default("").notNull(),
  position: integer("position").default(0).notNull(),
  isVisible: boolean("is_visible").default(true).notNull(),
  createdAt,
  updatedAt,
});

export const forums = pgTable(
  "forums",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    categoryId: bigint("category_id", { mode: "number" })
      .references(() => categories.id, { onDelete: "cascade" })
      .notNull(),
    parentForumId: bigint("parent_forum_id", { mode: "number" }).references(
      (): AnyPgColumn => forums.id,
      { onDelete: "cascade" },
    ),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    icon: text("icon"),
    color: text("color"),
    position: integer("position").default(0).notNull(),
    isPrivate: boolean("is_private").default(false).notNull(),
    threadCount: integer("thread_count").default(0).notNull(),
    postCount: integer("post_count").default(0).notNull(),
    latestThreadId: bigint("latest_thread_id", { mode: "number" }),
    latestPostAt: timestamp("latest_post_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("forums_category_parent_position_idx").on(
      table.categoryId,
      table.parentForumId,
      table.position,
    ),
    index("forums_title_trgm_idx").using("gin", table.title.op("gin_trgm_ops")),
    check("forums_thread_count_nonnegative", sql`${table.threadCount} >= 0`),
    check("forums_post_count_nonnegative", sql`${table.postCount} >= 0`),
  ],
);

export const forumAccessRules = pgTable("forum_access_rules", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  forumId: bigint("forum_id", { mode: "number" })
    .references(() => forums.id, { onDelete: "cascade" })
    .notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }),
  groupId: uuid("group_id").references(() => groups.id, {
    onDelete: "cascade",
  }),
  canRead: boolean("can_read").default(false).notNull(),
  canCreateThread: boolean("can_create_thread").default(false).notNull(),
  canReply: boolean("can_reply").default(false).notNull(),
  canModerate: boolean("can_moderate").default(false).notNull(),
});

export const threads = pgTable(
  "threads",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    forumId: bigint("forum_id", { mode: "number" })
      .references(() => forums.id, { onDelete: "restrict" })
      .notNull(),
    creatorId: text("creator_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    type: threadTypeEnum("type").default("discussion").notNull(),
    status: threadStatusEnum("status").default("open").notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    replyCount: integer("reply_count").default(0).notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    latestPostId: bigint("latest_post_id", { mode: "number" }),
    latestPostAt: timestamp("latest_post_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    latestPosterId: text("latest_poster_id").references(() => users.id),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(${sql.raw("title")}, ''))`,
    ),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("threads_forum_listing_idx")
      .on(table.forumId, table.isPinned, table.latestPostAt, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("threads_search_idx").using("gin", table.searchVector),
    index("threads_title_trgm_idx").using(
      "gin",
      table.title.op("gin_trgm_ops"),
    ),
    check("threads_reply_count_nonnegative", sql`${table.replyCount} >= 0`),
    check("threads_view_count_nonnegative", sql`${table.viewCount} >= 0`),
  ],
);

export const posts = pgTable(
  "posts",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    threadId: bigint("thread_id", { mode: "number" })
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    authorId: text("author_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    replyToPostId: bigint("reply_to_post_id", { mode: "number" }),
    content: jsonb("content").notNull(),
    plainText: text("plain_text").notNull(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(${sql.raw("plain_text")}, ''))`,
    ),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("posts_thread_cursor_idx")
      .on(table.threadId, table.id)
      .where(sql`${table.deletedAt} is null`),
    index("posts_author_idx").on(table.authorId, table.id),
    index("posts_search_idx").using("gin", table.searchVector),
  ],
);

export const postEditHistory = pgTable("post_edit_history", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  postId: bigint("post_id", { mode: "number" })
    .references(() => posts.id, { onDelete: "cascade" })
    .notNull(),
  editorId: text("editor_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  previousContent: jsonb("previous_content").notNull(),
  newContent: jsonb("new_content").notNull(),
  reason: text("reason").notNull(),
  createdAt,
});

export const threadReads = pgTable(
  "thread_reads",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    threadId: bigint("thread_id", { mode: "number" })
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    lastReadPostId: bigint("last_read_post_id", { mode: "number" }),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.threadId] })],
);

export const threadSubscriptions = pgTable(
  "thread_subscriptions",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    threadId: bigint("thread_id", { mode: "number" })
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    emailNotifications: boolean("email_notifications").default(false).notNull(),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.threadId] })],
);

export const threadViewBuckets = pgTable(
  "thread_view_buckets",
  {
    threadId: bigint("thread_id", { mode: "number" })
      .references(() => threads.id, { onDelete: "cascade" })
      .notNull(),
    day: date("day").notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    rolledUpAt: timestamp("rolled_up_at", { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.threadId, table.day] }),
    check("thread_view_bucket_nonnegative", sql`${table.viewCount} >= 0`),
  ],
);

export const reputationEvents = pgTable(
  "reputation_events",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    giverId: text("giver_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    recipientId: text("recipient_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    value: integer("value").notNull(),
    reason: text("reason").notNull(),
    threadId: bigint("thread_id", { mode: "number" }).references(
      () => threads.id,
    ),
    postId: bigint("post_id", { mode: "number" }).references(() => posts.id),
    reversalOfId: bigint("reversal_of_id", { mode: "number" }),
    createdAt,
  },
  (table) => [
    check("reputation_no_self", sql`${table.giverId} <> ${table.recipientId}`),
    check("reputation_value_valid", sql`${table.value} in (-1, 1)`),
    index("reputation_recipient_idx").on(table.recipientId, table.id),
  ],
);

export const vouches = pgTable(
  "vouches",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    authorId: text("author_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    recipientId: text("recipient_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    rating: vouchRatingEnum("rating").notNull(),
    comment: text("comment").notNull(),
    threadId: bigint("thread_id", { mode: "number" }).references(
      () => threads.id,
    ),
    status: moderationStatusEnum("status").default("actioned").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    check("vouches_no_self", sql`${table.authorId} <> ${table.recipientId}`),
    index("vouches_recipient_idx").on(
      table.recipientId,
      table.rating,
      table.id,
    ),
  ],
);

export const vouchDisputes = pgTable("vouch_disputes", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  vouchId: bigint("vouch_id", { mode: "number" })
    .references(() => vouches.id, { onDelete: "cascade" })
    .notNull(),
  reporterId: text("reporter_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  reason: text("reason").notNull(),
  status: moderationStatusEnum("status").default("open").notNull(),
  resolution: text("resolution"),
  createdAt,
  updatedAt,
});

export const badges = pgTable("badges", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  createdAt,
  updatedAt,
});

export const userBadges = pgTable(
  "user_badges",
  {
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    badgeId: uuid("badge_id")
      .references(() => badges.id, { onDelete: "cascade" })
      .notNull(),
    awardedById: text("awarded_by_id").references(() => users.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    position: integer("position").default(0).notNull(),
    createdAt,
  },
  (table) => [primaryKey({ columns: [table.userId, table.badgeId] })],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: conversationTypeEnum("type").default("direct").notNull(),
    directUserLowId: text("direct_user_low_id").references(() => users.id),
    directUserHighId: text("direct_user_high_id").references(() => users.id),
    directKey: text("direct_key").generatedAlwaysAs(
      sql`case when ${sql.raw("direct_user_low_id")} is null then null else ${sql.raw("direct_user_low_id")} || ':' || ${sql.raw("direct_user_high_id")} end`,
    ),
    latestMessageId: bigint("latest_message_id", { mode: "number" }),
    latestMessageAt: timestamp("latest_message_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("conversations_direct_key_unique")
      .on(table.directKey)
      .where(sql`${table.directKey} is not null`),
    index("conversations_latest_idx").on(table.latestMessageAt, table.id),
    check(
      "conversations_direct_members_distinct",
      sql`${table.directUserLowId} is null or ${table.directUserLowId} <> ${table.directUserHighId}`,
    ),
  ],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lastReadMessageId: bigint("last_read_message_id", { mode: "number" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    mutedUntil: timestamp("muted_until", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.userId] }),
    index("conversation_members_inbox_idx").on(
      table.userId,
      table.archivedAt,
      table.conversationId,
    ),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    conversationId: uuid("conversation_id")
      .references(() => conversations.id, { onDelete: "cascade" })
      .notNull(),
    senderId: text("sender_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    replyToMessageId: bigint("reply_to_message_id", { mode: "number" }),
    clientRequestId: uuid("client_request_id").notNull(),
    content: jsonb("content").notNull(),
    plainText: text("plain_text").notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (table) => [
    uniqueIndex("messages_idempotency_unique").on(
      table.senderId,
      table.clientRequestId,
    ),
    index("messages_conversation_cursor_idx").on(
      table.conversationId,
      table.id,
    ),
  ],
);

export const userBlocks = pgTable(
  "user_blocks",
  {
    blockerId: text("blocker_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    blockedId: text("blocked_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt,
  },
  (table) => [
    primaryKey({ columns: [table.blockerId, table.blockedId] }),
    check("user_blocks_no_self", sql`${table.blockerId} <> ${table.blockedId}`),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    actorId: text("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: text("type").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    eventKey: text("event_key").unique(),
    title: text("title").notNull(),
    href: text("href").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("notifications_user_unread_idx").on(
      table.userId,
      table.readAt,
      table.id,
    ),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: text("owner_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    state: attachmentStateEnum("state").default("pending").notNull(),
    purpose: text("purpose").notNull(),
    resourceId: text("resource_id"),
    scanStatus: text("scan_status").default("pending").notNull(),
    scannedAt: timestamp("scanned_at", { withTimezone: true }),
    originalName: text("original_name"),
    storageKey: text("storage_key").notNull().unique(),
    mediaType: text("media_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum").notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("attachments_owner_state_idx").on(
      table.ownerId,
      table.state,
      table.createdAt,
    ),
    check(
      "attachments_size_valid",
      sql`${table.byteSize} > 0 and ${table.byteSize} <= 10485760`,
    ),
  ],
);

export const postAttachments = pgTable(
  "post_attachments",
  {
    postId: bigint("post_id", { mode: "number" })
      .references(() => posts.id, { onDelete: "cascade" })
      .notNull(),
    attachmentId: uuid("attachment_id")
      .references(() => attachments.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.postId, table.attachmentId] })],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    messageId: bigint("message_id", { mode: "number" })
      .references(() => messages.id, { onDelete: "cascade" })
      .notNull(),
    attachmentId: uuid("attachment_id")
      .references(() => attachments.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.attachmentId] })],
);

export const reports = pgTable(
  "reports",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    reporterId: text("reporter_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    targetUserId: text("target_user_id").references(() => users.id),
    targetThreadId: bigint("target_thread_id", { mode: "number" }).references(
      () => threads.id,
    ),
    targetPostId: bigint("target_post_id", { mode: "number" }).references(
      () => posts.id,
    ),
    targetMessageId: bigint("target_message_id", { mode: "number" }).references(
      () => messages.id,
    ),
    category: text("category").notNull(),
    reason: text("reason").notNull(),
    status: moderationStatusEnum("status").default("open").notNull(),
    priority: integer("priority").default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (table) => [
    index("reports_queue_idx").on(
      table.status,
      table.priority,
      table.createdAt,
      table.id,
    ),
    check(
      "reports_exactly_one_target",
      sql`num_nonnulls(${table.targetUserId}, ${table.targetThreadId}, ${table.targetPostId}, ${table.targetMessageId}) = 1`,
    ),
  ],
);

export const moderationActions = pgTable("moderation_actions", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  actorId: text("actor_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull(),
  subjectUserId: text("subject_user_id").references(() => users.id),
  reportId: bigint("report_id", { mode: "number" }).references(
    () => reports.id,
  ),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  reversalOfId: bigint("reversal_of_id", { mode: "number" }),
  createdAt,
});

export const userRestrictions = pgTable(
  "user_restrictions",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    issuedById: text("issued_by_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    type: text("type").notNull(),
    scope: text("scope").notNull(),
    reason: text("reason").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt,
  },
  (table) => [
    index("user_restrictions_active_idx").on(
      table.userId,
      table.endsAt,
      table.revokedAt,
    ),
  ],
);

export const creditLedgerEntries = pgTable(
  "credit_ledger_entries",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .references(() => users.id, { onDelete: "restrict" })
      .notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull().unique(),
    createdAt,
  },
  (table) => [
    index("credit_ledger_user_idx").on(table.userId, table.id),
    check("credit_balance_after_nonnegative", sql`${table.balanceAfter} >= 0`),
  ],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").default(false).notNull(),
  description: text("description").notNull(),
  updatedById: text("updated_by_id").references(() => users.id),
  version: integer("version").default(1).notNull(),
  updatedAt,
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedById: text("updated_by_id").references(() => users.id),
  version: integer("version").default(1).notNull(),
  updatedAt,
});

export const sellerProfiles = pgTable("seller_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(), description: text("description").notNull(),
  status: text("status").default("active").notNull(),
  policyVersion: text("policy_version").notNull(), policyAcceptedAt: timestamp("policy_accepted_at", { withTimezone: true }).notNull(),
  createdAt, updatedAt,
}, table => [check("seller_status_valid", sql`${table.status} in ('active','suspended','closed')`)]);
export const marketplaceCategories = pgTable("marketplace_categories", {
  id: uuid("id").defaultRandom().primaryKey(), slug: text("slug").notNull().unique(), name: text("name").notNull(),
  parentId: uuid("parent_id").references((): AnyPgColumn => marketplaceCategories.id, { onDelete: "restrict" }),
  archivedAt: timestamp("archived_at", { withTimezone: true }), createdAt, updatedAt,
}, table => [check("marketplace_category_not_self", sql`${table.parentId} is null or ${table.parentId} <> ${table.id}`)]);
export const listings = pgTable("listings", {
  id: uuid("id").defaultRandom().primaryKey(), sellerId: text("seller_id").notNull().references(() => sellerProfiles.userId, { onDelete: "restrict" }),
  categoryId: uuid("category_id").references(() => marketplaceCategories.id, { onDelete: "restrict" }),
  title: text("title").notNull(), slug: text("slug").notNull(), description: text("description").notNull(),
  kind: text("kind").notNull(), fulfillmentMode: text("fulfillment_mode").notNull(), deliveryTerms: text("delivery_terms").notNull(),
  priceCents: integer("price_cents").notNull(), available: boolean("available").default(true).notNull(),
  status: text("status").default("draft").notNull(), version: integer("version").default(1).notNull(), createdAt, updatedAt,
}, table => [check("listing_positive_price", sql`${table.priceCents} > 0`), check("listing_kind_valid", sql`${table.kind} in ('digital','service')`), check("listing_fulfillment_valid", sql`${table.fulfillmentMode} in ('text','file','manual')`), check("listing_status_valid", sql`${table.status} in ('draft','published','paused','archived','removed')`), check("listing_version_positive", sql`${table.version} > 0`), index("listing_discovery_idx").on(table.status, table.categoryId, table.createdAt), index("listing_seller_idx").on(table.sellerId, table.id)]);
export const listingRevisions = pgTable("listing_revisions", {
  id: uuid("id").defaultRandom().primaryKey(), listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "restrict" }),
  version: integer("version").notNull(), title: text("title").notNull(), description: text("description").notNull(),
  kind: text("kind").notNull(), priceCents: integer("price_cents").notNull(), fulfillmentMode: text("fulfillment_mode").notNull(), deliveryTerms: text("delivery_terms").notNull(),
  protectedText: text("protected_text"), protectedFileId: uuid("protected_file_id").references(() => attachments.id, { onDelete: "restrict" }), createdAt,
}, table => [uniqueIndex("listing_revision_unique").on(table.listingId, table.version), check("revision_positive_price", sql`${table.priceCents} > 0`)]);
export const listingFavorites = pgTable("listing_favorites", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "restrict" }), createdAt,
}, table => [primaryKey({ columns: [table.userId, table.listingId] })]);
export const carts = pgTable("carts", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }), version: integer("version").default(1).notNull(), createdAt, updatedAt,
});
export const cartItems = pgTable("cart_items", {
  userId: text("user_id").notNull().references(() => carts.userId, { onDelete: "cascade" }), listingId: uuid("listing_id").notNull().references(() => listings.id, { onDelete: "restrict" }), addedPriceCents: integer("added_price_cents").notNull(), createdAt,
}, table => [primaryKey({ columns: [table.userId, table.listingId] })]);
export const domainAuditEvents = pgTable("domain_audit_events", {
  id: uuid("id").defaultRandom().primaryKey(), actorId: text("actor_id").notNull().references(() => users.id, { onDelete: "restrict" }),
  resourceType: text("resource_type").notNull(), resourceId: text("resource_id").notNull(), action: text("action").notNull(), reason: text("reason").notNull(), metadata: jsonb("metadata").notNull().default({}), createdAt,
}, table => [index("domain_audit_resource_idx").on(table.resourceType, table.resourceId, table.createdAt)]);
export const legacyListingImports = pgTable("legacy_listing_imports", {
  legacyThreadId: bigint("legacy_thread_id", { mode: "number" }).primaryKey(), listingId: uuid("listing_id").references(() => listings.id, { onDelete: "restrict" }),
  sourceRecord: jsonb("source_record").notNull(), sourceChecksum: text("source_checksum").notNull(), status: text("status").notNull().default("needs_review"), createdAt,
});

export const notificationPreferences = pgTable("notification_preferences", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), inApp: boolean("in_app").default(true).notNull(), email: boolean("email").default(false).notNull(), updatedAt,
}, table => [primaryKey({ columns: [table.userId, table.eventType] })]);
export const notificationOutbox = pgTable("notification_outbox", {
  id: uuid("id").defaultRandom().primaryKey(), notificationId: bigint("notification_id", { mode: "number" }).notNull().unique().references(() => notifications.id, { onDelete: "restrict" }),
  status: text("status").default("pending").notNull(), attempts: integer("attempts").default(0).notNull(), availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }), lastError: text("last_error"), deliveredAt: timestamp("delivered_at", { withTimezone: true }), createdAt,
}, table => [check("outbox_status_valid", sql`${table.status} in ('pending','processing','delivered','skipped','failed')`), index("outbox_pending_idx").on(table.status, table.availableAt)]);
export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(), creatorId: text("creator_id").notNull().references(() => users.id, { onDelete: "restrict" }), respondentId: text("respondent_id").references(() => users.id, { onDelete: "restrict" }),
  payerId: text("payer_id").references(() => users.id, { onDelete: "restrict" }), name: text("name").notNull(), amountCents: integer("amount_cents").notNull(), terms: text("terms").notNull(),
  state: text("state").default("DRAFT").notNull(), version: integer("version").default(1).notNull(), conversationId: uuid("conversation_id").unique().references(() => conversations.id, { onDelete: "restrict" }),
  createdAt, updatedAt,
}, table => [check("deal_pre_funding_states", sql`${table.state} in ('DRAFT','PENDING_ACCEPTANCE','AWAITING_FUNDING','DECLINED','CANCELLED')`), check("deal_positive_amount", sql`${table.amountCents} > 0`), check("deal_distinct_parties", sql`${table.respondentId} is null or ${table.creatorId} <> ${table.respondentId}`), check("deal_payer_party", sql`${table.payerId} is null or ${table.payerId} = ${table.creatorId} or ${table.payerId} = ${table.respondentId}`), index("deal_creator_idx").on(table.creatorId, table.createdAt), index("deal_respondent_idx").on(table.respondentId, table.createdAt)]);
export const dealTerms = pgTable("deal_terms", {
  dealId: uuid("deal_id").primaryKey().references(() => deals.id, { onDelete: "restrict" }), version: integer("version").notNull(), name: text("name").notNull(), terms: text("terms").notNull(), amountCents: integer("amount_cents").notNull(),
  payerId: text("payer_id").notNull().references(() => users.id), creatorId: text("creator_id").notNull().references(() => users.id), respondentId: text("respondent_id").notNull().references(() => users.id), createdAt,
});
export const dealAcceptances = pgTable("deal_acceptances", { dealId: uuid("deal_id").notNull().references(() => dealTerms.dealId, { onDelete: "restrict" }), userId: text("user_id").notNull().references(() => users.id), termsVersion: integer("terms_version").notNull(), createdAt }, table => [primaryKey({ columns: [table.dealId, table.userId] })]);
export const dealEvents = pgTable("deal_events", { id: uuid("id").defaultRandom().primaryKey(), dealId: uuid("deal_id").notNull().references(() => deals.id, { onDelete: "restrict" }), actorId: text("actor_id").notNull().references(() => users.id), operationId: uuid("operation_id").notNull(), requestVersion: integer("request_version"), action: text("action").notNull(), resultingState: text("resulting_state").notNull(), createdAt }, table => [uniqueIndex("deal_event_operation_unique").on(table.actorId, table.operationId)]);
export const supportCases = pgTable("support_cases", { id: uuid("id").defaultRandom().primaryKey(), creatorId: text("creator_id").notNull().references(() => users.id), dealId: uuid("deal_id").references(() => deals.id), conversationId: uuid("conversation_id").references(() => conversations.id), subject: text("subject").notNull(), status: text("status").default("open").notNull(), assignedToId: text("assigned_to_id").references(() => users.id), createdAt, updatedAt }, table => [check("support_state_valid", sql`${table.status} in ('open','in_review','resolved','closed')`)]);
export const supportEvents = pgTable("support_events", { id: uuid("id").defaultRandom().primaryKey(), caseId: uuid("case_id").notNull().references(() => supportCases.id), actorId: text("actor_id").notNull().references(() => users.id), kind: text("kind").notNull(), body: text("body").notNull(), createdAt });
