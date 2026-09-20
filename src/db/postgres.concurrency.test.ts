// @vitest-environment node
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { eq, inArray } from "drizzle-orm";
import nextEnv from "@next/env";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

nextEnv.loadEnvConfig(process.cwd());

const context = vi.hoisted(() => ({ databaseUrl: "" }));
const actors = new AsyncLocalStorage<string>();
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { COMMUNITY_ACCESS_MODE: "public", get DATABASE_URL() { return context.databaseUrl; } } }));
vi.mock("@/lib/session", () => ({ requireMember: async () => { const id = actors.getStore(); if (!id) throw new Error("No fixture actor"); return { user: { id } }; } }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
import { modifySelection } from "@/domains/commerce/commerce-service";
import { transitionDeal } from "@/domains/deals/deal-service";
import { sendMessage, startConversation } from "@/domains/messaging/message-service";

// Explicit opt-in only. Real row/advisory locks, transactions and service code;
// request authentication and rate-limit providers are isolated from this test.
describe.skipIf(process.env.LIVE_DATABASE_TESTS !== "1")("real PostgreSQL concurrency", () => {
  const suffix = randomUUID().slice(0, 8);
  const buyer = `race_buyer_${suffix}`;
  const seller = `race_seller_${suffix}`;
  const listingId = randomUUID();
  const dealId = randomUUID();
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  const conversationIds: string[] = [];
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("LIVE_DATABASE_TESTS requires DATABASE_URL");
    context.databaseUrl = process.env.DATABASE_URL;
    pool = new Pool({ connectionString: context.databaseUrl });
    db = drizzle(pool, { schema });
    await db.insert(schema.users).values([buyer, seller].map(id => ({ id, name: id, username: id, email: `${id}@example.test`, emailVerified: true, accountStatus: "active" as const, membershipStatus: "approved" })));
    await db.insert(schema.sellerProfiles).values({ userId: seller, name: "Concurrency fixture", description: "Temporary test record", policyVersion: "test-fixture", policyAcceptedAt: new Date() });
    await db.insert(schema.listings).values({ id: listingId, sellerId: seller, title: "Concurrency fixture", slug: "concurrency", description: "Temporary test record", kind: "service", fulfillmentMode: "manual", deliveryTerms: "Temporary fixture", priceCents: 100, status: "published" });
    await db.insert(schema.deals).values({ id: dealId, creatorId: buyer, respondentId: seller, payerId: buyer, name: "Race fixture", amountCents: 100, terms: "Temporary agreement for acceptance tests." });
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    const notices = await db.select({ id: schema.notifications.id }).from(schema.notifications).where(inArray(schema.notifications.userId, [buyer, seller]));
    if (notices.length) await db.delete(schema.notificationOutbox).where(inArray(schema.notificationOutbox.notificationId, notices.map(row => row.id)));
    await db.delete(schema.notifications).where(inArray(schema.notifications.userId, [buyer, seller]));
    await db.delete(schema.dealAcceptances).where(eq(schema.dealAcceptances.dealId, dealId));
    await db.delete(schema.dealEvents).where(eq(schema.dealEvents.dealId, dealId));
    await db.delete(schema.dealTerms).where(eq(schema.dealTerms.dealId, dealId));
    await db.delete(schema.deals).where(eq(schema.deals.id, dealId));
    if (conversationIds.length) {
      await db.update(schema.conversations).set({ latestMessageId: null }).where(inArray(schema.conversations.id, conversationIds));
      await db.delete(schema.conversationMembers).where(inArray(schema.conversationMembers.conversationId, conversationIds));
      await db.delete(schema.messages).where(inArray(schema.messages.conversationId, conversationIds));
      await db.delete(schema.conversations).where(inArray(schema.conversations.id, conversationIds));
    }
    await db.delete(schema.domainAuditEvents).where(inArray(schema.domainAuditEvents.actorId, [buyer, seller]));
    await db.delete(schema.cartItems).where(eq(schema.cartItems.listingId, listingId));
    await db.delete(schema.listings).where(eq(schema.listings.id, listingId));
    await db.delete(schema.sellerProfiles).where(eq(schema.sellerProfiles.userId, seller));
    await db.delete(schema.users).where(inArray(schema.users.id, [buyer, seller]));
    await pool.end();
  }, 30000);
  it("concurrent cart adds persist one line", async () => {
    await Promise.all(Array.from({ length: 4 }, () => actors.run(buyer, () => modifySelection(listingId, "cart.add"))));
    expect(await db.select().from(schema.cartItems).where(eq(schema.cartItems.listingId, listingId))).toHaveLength(1);
  }, 30000);
  it("concurrent direct contact and duplicate sends retain one conversation/message", async () => {
    const results = await Promise.all([actors.run(buyer, () => startConversation(seller)), actors.run(seller, () => startConversation(buyer))]);
    const firstResult = results[0];
    if ("error" in firstResult) throw new Error(firstResult.error);
    const id = firstResult.id;
    conversationIds.push(id);
    const secondResult = results[1];
    if ("error" in secondResult) throw new Error(secondResult.error);
    expect(secondResult.id).toBe(id);
    const request = { conversationId: id, requestId: randomUUID(), text: "Concurrent retry fixture" };
    const messages = await Promise.all(Array.from({ length: 3 }, () => actors.run(buyer, () => sendMessage(request))));
    expect(new Set(messages.map(message => message.id)).size).toBe(1);
    expect(await db.select().from(schema.messages).where(eq(schema.messages.conversationId, id))).toHaveLength(1);
  }, 30000);
  it("accept/cancel on the same agreement version commits exactly one transition", async () => {
    await actors.run(buyer, () => transitionDeal({ id: dealId, version: 1, operationId: randomUUID(), action: "invite" }));
    const [invited] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
    if (invited.conversationId) conversationIds.push(invited.conversationId);
    const results = await Promise.all([
      actors.run(seller, () => transitionDeal({ id: dealId, version: 2, operationId: randomUUID(), action: "accept" })),
      actors.run(buyer, () => transitionDeal({ id: dealId, version: 2, operationId: randomUUID(), action: "cancel" })),
    ]);
    expect(results.filter(result => result.error)).toHaveLength(1);
    const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
    expect(["CANCELLED", "AWAITING_FUNDING"]).toContain(deal.state);
    expect(deal.version).toBe(3);
    expect(await db.select().from(schema.dealEvents).where(eq(schema.dealEvents.dealId, dealId))).toHaveLength(2);
  }, 30000);
});
