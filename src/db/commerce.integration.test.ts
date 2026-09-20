// @vitest-environment node
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const context = vi.hoisted(() => ({ db: null as unknown, actor: "buyer" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { COMMUNITY_ACCESS_MODE: "public" }, isR2Configured: false }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => context.actor ? { user: { id: context.actor }, session: { id: "fixture" } } : null } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/db/client", () => ({ createReadDatabase: () => context.db }));
vi.mock("@/db/transaction", () => ({ withTransaction: (operation: Parameters<ReturnType<typeof drizzle>["transaction"]>[0]) => (context.db as ReturnType<typeof drizzle>).transaction(operation) }));

import { activeCategories, catalog, checkoutReview, enrollSeller, modifySelection, saveListing, sellerWorkspaceHref } from "@/domains/commerce/commerce-service";
import { topSubforums } from "@/db/queries/community";
import { authorizeFileResource } from "@/domains/delivery/file-service";
import { findDeal, saveDealDraft, transitionDeal } from "@/domains/deals/deal-service";
import { conversationOperation, sendMessage, startConversation } from "@/domains/messaging/message-service";
import { visibleNotifications } from "@/domains/notifications/notification-service";

const pg = new PGlite({ extensions: { citext, pg_trgm } });
const db = drizzle(pg, { schema });
let listingId: string;
const input = { title: "Member design consultation", description: "A detailed consultation with an independent designer.", categoryId: "", kind: "service", fulfillmentMode: "manual", deliveryTerms: "Arrange a time through messages.", price: "12.34", available: true, status: "published" };
beforeAll(async () => {
  context.db = db;
  const journal: { entries: { tag: string }[] } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) await pg.exec(await readFile(`drizzle/${tag}.sql`, "utf8"));
  for (const id of ["buyer", "seller", "outsider"]) await db.insert(schema.users).values({ id, name: id, username: `test_${id}`, email: `${id}@example.test`, emailVerified: true, accountStatus: "active", membershipStatus: "pending" });
  context.actor = "seller";
  await enrollSeller({ name: "Design studio", description: "Independent design and consulting services.", acceptedPolicy: "on" });
  const result = await saveListing(input);
  if (!result.id) throw new Error(result.error);
  listingId = result.id;
  context.actor = "buyer";
}, 30000);
afterAll(async () => { await pg.close(); });

it("keeps empty taxonomy truthful and routes enrollment by canonical ownership", async () => {
  expect(await activeCategories()).toEqual([]);
  expect(await sellerWorkspaceHref()).toBe("/seller/onboarding");
  context.actor = "seller";
  expect(await sellerWorkspaceHref()).toBe("/seller");
  context.actor = "buyer";
});
it("projects only clean listing media and the seller avatar, never protected delivery", async () => {
  const protectedId = crypto.randomUUID();
  const imageId = crypto.randomUUID();
  await db.insert(schema.attachments).values([
    { id: protectedId, ownerId: "seller", purpose: "listing_delivery", resourceId: listingId, state: "ready", scanStatus: "clean", storageKey: "private/payload", mediaType: "image/webp", byteSize: 10, checksum: "a".repeat(64) },
    { ownerId: "seller", purpose: "listing_media", resourceId: listingId, state: "pending", scanStatus: "pending", storageKey: "quarantine/image", mediaType: "image/webp", byteSize: 10, checksum: "a".repeat(64) },
    { id: imageId, ownerId: "seller", purpose: "listing_media", resourceId: listingId, state: "ready", scanStatus: "clean", storageKey: "private/image", mediaType: "image/webp", byteSize: 10, checksum: "a".repeat(64) },
  ]);
  await db.update(schema.profiles).set({ avatarUrl: `/api/files/${crypto.randomUUID()}` }).where(eq(schema.profiles.userId, "seller"));
  const [row] = await catalog();
  expect(row.imageId).toBe(imageId);
  expect(row.sellerAvatar).toMatch(/^\/api\/files\//);
  expect(JSON.stringify(row)).not.toContain("private/payload");
  expect(await authorizeFileResource("listing_delivery", listingId, false)).toBe(false);
  expect(await authorizeFileResource("listing_media", listingId, false)).toBe(true);
  await db.update(schema.listings).set({ status: "draft" }).where(eq(schema.listings.id, listingId));
  expect(await catalog()).toEqual([]);
  expect(await authorizeFileResource("listing_media", listingId, false)).toBe(false);
  await db.update(schema.listings).set({ status: "published" }).where(eq(schema.listings.id, listingId));
});
it("persists idempotent carts, reports changed prices and hides unpublished metadata", async () => {
  await modifySelection(listingId, "cart.add");
  await modifySelection(listingId, "cart.add");
  expect(await db.select().from(schema.cartItems)).toHaveLength(1);
  expect((await checkoutReview())[0]).toMatchObject({ available: true, changed: false });
  await db.update(schema.listings).set({ priceCents: 2000 }).where(eq(schema.listings.id, listingId));
  expect((await checkoutReview())[0]).toMatchObject({ available: true, changed: true });
  await db.update(schema.listings).set({ status: "removed" }).where(eq(schema.listings.id, listingId));
  expect((await checkoutReview())[0]).toMatchObject({ available: false, listing: null, sellerName: null });
  expect(await modifySelection(listingId, "cart.add")).toHaveProperty("error");
  context.actor = "outsider";
  expect(await checkoutReview()).toEqual([]);
  await expect(saveListing({ ...input, id: listingId, version: 1 })).resolves.toHaveProperty("error");
  context.actor = "seller";
  expect(await modifySelection(listingId, "cart.add")).toHaveProperty("error");
  await db.update(schema.listings).set({ status: "published" }).where(eq(schema.listings.id, listingId));
  context.actor = "buyer";
});
it("ranks readable forums only and excludes deleted discussions from counts", async () => {
  const [category] = await db.insert(schema.categories).values({ slug: "test", title: "Test" }).returning();
  const [open, privateForum] = await db.insert(schema.forums).values([{ categoryId: category.id, slug: "open", title: "Open" }, { categoryId: category.id, slug: "private", title: "Secret forum", isPrivate: true }]).returning();
  await db.insert(schema.threads).values([
    { forumId: open.id, creatorId: "buyer", slug: "discussion", title: "Discussion" },
    { forumId: open.id, creatorId: "buyer", slug: "deleted", title: "Deleted", status: "deleted" },
    { forumId: privateForum.id, creatorId: "seller", slug: "secret", title: "Secret" },
  ]);
  expect(await topSubforums()).toEqual([{ id: open.id, slug: "open", title: "Open", discussionCount: 1 }]);
});
it.each(["creator", "respondent"])("freezes %s-payer consent, deduplicates acceptance, and denies financial transitions", async payer => {
  const draft = await saveDealDraft({ name: "Design agreement", respondent: "test_seller", payer, amount: "20.00", terms: "Provide the design described in this agreement." });
  if ("error" in draft) throw new Error(draft.error);
  context.actor = "outsider";
  expect(await findDeal(draft.id)).toBeNull();
  await expect(transitionDeal({ id: draft.id, version: 1, operationId: crypto.randomUUID(), action: "invite" })).rejects.toThrow("FORBIDDEN");
  context.actor = "buyer";
  expect(await transitionDeal({ id: draft.id, version: 1, operationId: crypto.randomUUID(), action: "invite" })).toEqual({ state: "PENDING_ACCEPTANCE" });
  expect(await saveDealDraft({ name: "Changed agreement", id: draft.id, version: 2, respondent: "test_seller", payer, amount: "20.00", terms: "Changed terms after the invitation was sent." })).toHaveProperty("error");
  context.actor = "seller";
  const acceptance = { id: draft.id, version: 2, operationId: crypto.randomUUID(), action: "accept" };
  expect(await transitionDeal(acceptance)).toEqual({ state: "AWAITING_FUNDING" });
  expect(await transitionDeal(acceptance)).toEqual({ state: "AWAITING_FUNDING" });
  await expect(transitionDeal({ ...acceptance, version: 3 })).rejects.toThrow("Operation ID reused");
  for (const action of ["fund", "pay", "deliver", "settle", "refund", "withdraw"]) await expect(transitionDeal({ ...acceptance, action })).rejects.toThrow();
  const [terms] = await db.select().from(schema.dealTerms).where(eq(schema.dealTerms.dealId, draft.id));
  expect(terms.payerId).toBe(payer === "creator" ? "buyer" : "seller");
  expect(await db.select().from(schema.dealAcceptances).where(eq(schema.dealAcceptances.dealId, draft.id))).toHaveLength(2);
  context.actor = "buyer";
});
it("deduplicates messages, rejects outsiders and cross-conversation replies, and honors blocks", async () => {
  const conversation = await startConversation("test_seller");
  if ("error" in conversation) throw new Error(conversation.error);
  expect(await startConversation("test_seller")).toEqual(conversation);
  const request = { conversationId: conversation.id, requestId: crypto.randomUUID(), text: "Can we discuss the design?" };
  const message = await sendMessage(request);
  expect(await sendMessage(request)).toEqual(message);
  expect(await sendMessage({ ...request, text: "Different content" })).toHaveProperty("error");
  context.actor = "outsider";
  await expect(sendMessage({ ...request, requestId: crypto.randomUUID() })).rejects.toThrow("FORBIDDEN");
  expect(await authorizeFileResource("conversation", conversation.id, false)).toBe(false);
  const other = await startConversation("test_seller");
  if ("error" in other) throw new Error(other.error);
  expect(await sendMessage({ conversationId: other.id, requestId: crypto.randomUUID(), text: "Invalid reply", replyToId: message.id })).toHaveProperty("error");
  context.actor = "seller";
  expect((await visibleNotifications()).rows.some(row => row.resourceId === conversation.id)).toBe(true);
  await conversationOperation({ conversationId: conversation.id, operation: "block" });
  context.actor = "buyer";
  expect(await sendMessage({ ...request, requestId: crypto.randomUUID() })).toHaveProperty("error");
});
it("rejects guest discovery and a newly restricted seller", async () => {
  context.actor = "";
  await expect(catalog()).rejects.toThrow("FORBIDDEN");
  await expect(topSubforums()).rejects.toThrow("FORBIDDEN");
  context.actor = "buyer";
  await db.update(schema.users).set({ accountStatus: "suspended" }).where(eq(schema.users.id, "seller"));
  expect(await catalog()).toEqual([]);
  expect(await authorizeFileResource("listing_media", listingId, false)).toBe(false);
});
