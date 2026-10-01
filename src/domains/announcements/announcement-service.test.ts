// @vitest-environment node
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const context = vi.hoisted(() => ({ db: null as unknown, actor: "admin-user", allowAdmin: true, member: true }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { COMMUNITY_ACCESS_MODE: "private", TELEGRAM_NOTIFICATIONS_ENABLED: true, TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_BRIDGE_SECRET: "test-secret", NEXT_PUBLIC_APP_URL: "https://example.test" }, isR2Configured: false }));
vi.mock("@/lib/session", () => ({
  requireMember: async () => { if (!context.member) throw new Error("FORBIDDEN"); return { user: { id: context.actor } }; },
  requirePermission: async () => { if (!context.allowAdmin) throw new Error("FORBIDDEN"); return { user: { id: context.actor } }; },
}));
vi.mock("@/db/client", () => ({ createReadDatabase: () => context.db }));
vi.mock("@/db/transaction", () => ({ withTransaction: (operation: Parameters<ReturnType<typeof drizzle>["transaction"]>[0]) => (context.db as ReturnType<typeof drizzle>).transaction(operation) }));
import { findAnnouncement, listAnnouncements, removeAnnouncement, saveAnnouncement } from "./announcement-service";
import { announcementInputSchema, announcementTelegramText } from "./validation";
import { deliverTelegramNotifications } from "@/domains/notifications/maintenance";
import { saveTelegramPreferences, telegramEvents, telegramState, disconnectTelegram } from "@/domains/notifications/telegram";

const pg = new PGlite({ extensions: { citext, pg_trgm } });
const db = drizzle(pg, { schema });
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const input = (title = "Community update") => ({ id: randomUUID(), title, content: JSON.stringify(doc("Please read this important community update.")), pinned: false, important: false });

beforeAll(async () => {
  const journal: { entries: { tag: string }[] } = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  for (const { tag } of journal.entries) await pg.exec(await readFile(`drizzle/${tag}.sql`, "utf8"));
  context.db = db;
  await pg.exec(`INSERT INTO users (id,name,email,email_verified,username,account_status,membership_status) VALUES
    ('admin-user','Admin','admin@test.example',true,'adminuser','active','approved'),
    ('recipient','Recipient','recipient@test.example',true,'recipient','active','approved'),
    ('disabled','Disabled','disabled@test.example',true,'disabled','active','approved'),
    ('unconnected','Unconnected','unconnected@test.example',true,'unconnected','active','approved'),
    ('banned','Banned','banned@test.example',true,'banneduser','banned','approved'),
    ('pending','Pending','pending@test.example',true,'pendinguser','active','pending');
    INSERT INTO roles (key,name,permissions) VALUES ('announcement-admin','announcement-admin',ARRAY['admin.manage']);
    INSERT INTO user_roles (user_id,role_id) SELECT 'admin-user',id FROM roles WHERE name='announcement-admin';
    INSERT INTO telegram_connections (user_id,telegram_user_id,private_chat_id) VALUES ('recipient',101,101),('disabled',102,102),('banned',103,103),('pending',104,104);
    INSERT INTO telegram_preferences (user_id,event_type,enabled) VALUES ('disabled','announcement.published',false);`);
}, 30_000);
afterAll(async () => { vi.unstubAllGlobals(); await pg.close(); });
beforeEach(async () => {
  context.actor = "admin-user"; context.allowAdmin = true; context.member = true;
  await pg.exec("TRUNCATE telegram_outbox, notifications, domain_audit_events, announcements CASCADE;");
  await db.update(schema.telegramPreferences).set({ enabled: true }).where(eq(schema.telegramPreferences.userId, "recipient"));
  vi.unstubAllGlobals();
});

it("validates titles, empty/oversized bodies, malformed JSON, and deeply nested content", () => {
  expect(announcementInputSchema.safeParse(input()).success).toBe(true);
  for (const change of [{ title: " " }, { title: "x".repeat(161) }, { content: "{" }, { content: JSON.stringify(doc(" ")) }, { content: JSON.stringify(doc("x".repeat(20_001))) }, { content: "x".repeat(100_001) }]) {
    expect(announcementInputSchema.safeParse({ ...input(), ...change }).success).toBe(false);
  }
  let nested: unknown = doc("hello");
  for (let i = 0; i < 60; i++) nested = { type: "doc", content: [nested] };
  expect(announcementInputSchema.safeParse({ ...input(), content: JSON.stringify(nested) }).success).toBe(false);
});

it("requires admin authorization both at entry and inside the transaction", async () => {
  context.allowAdmin = false;
  await expect(saveAnnouncement(input(), "publish")).rejects.toThrow("FORBIDDEN");
  await expect(removeAnnouncement(randomUUID())).rejects.toThrow("FORBIDDEN");
  context.allowAdmin = true; context.actor = "recipient";
  await expect(saveAnnouncement(input(), "publish")).rejects.toThrow("FORBIDDEN");
  await expect(removeAnnouncement(randomUUID())).rejects.toThrow("FORBIDDEN");
  expect(await db.select().from(schema.announcements)).toHaveLength(0);
});

it("publishes atomically only to eligible connected opted-in members and prevents duplicates", async () => {
  const value = input();
  expect(await saveAnnouncement(value, "publish")).toEqual({ id: value.id });
  expect(await saveAnnouncement(value, "publish")).toHaveProperty("error");
  expect(await db.select().from(schema.announcements)).toHaveLength(1);
  expect(await db.select().from(schema.notifications)).toEqual([expect.objectContaining({ userId: "recipient", type: "announcement.published", readAt: expect.any(Date), href: `/announcements/${value.id}` })]);
  expect(await db.select().from(schema.telegramOutbox)).toHaveLength(1);
  expect(await db.select().from(schema.domainAuditEvents)).toEqual([expect.objectContaining({ action: "announcement.publish", actorId: "admin-user" })]);
  const updated = { ...value, title: "Updated announcement", pinned: true, important: true };
  expect(await saveAnnouncement(updated, "edit")).toEqual({ id: value.id });
  expect((await findAnnouncement(value.id))?.title).toBe(updated.title);
  expect(await db.select().from(schema.telegramOutbox)).toHaveLength(1);
  expect(await removeAnnouncement(value.id)).toEqual({ id: value.id });
  expect(await findAnnouncement(value.id)).toBeNull();
  expect((await listAnnouncements()).rows).toHaveLength(0);
  expect(await saveAnnouncement(updated, "edit")).toHaveProperty("error");
  expect(await db.select().from(schema.domainAuditEvents)).toHaveLength(3);
});

it("rolls back publication and notification records when enqueueing fails", async () => {
  await pg.exec("ALTER TABLE telegram_outbox ADD CONSTRAINT fail_enqueue CHECK (false)");
  await expect(saveAnnouncement(input(), "publish")).rejects.toThrow();
  await pg.exec("ALTER TABLE telegram_outbox DROP CONSTRAINT fail_enqueue");
  expect(await db.select().from(schema.announcements)).toHaveLength(0);
  expect(await db.select().from(schema.notifications)).toHaveLength(0);
  expect(await db.select().from(schema.domainAuditEvents)).toHaveLength(0);
});

it("orders pinned first and paginates with a stable ID tie-breaker; member reads are guarded", async () => {
  const values = Array.from({ length: 22 }, (_, index) => ({ ...input(`Post ${index}`), pinned: index < 2 }));
  for (const value of values) await saveAnnouncement(value, "publish");
  await db.update(schema.announcements).set({ publishedAt: new Date("2026-09-30T00:00:00Z") });
  const sorted = [...values].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.id.localeCompare(a.id));
  const first = await listAnnouncements();
  expect(first.rows.map(row => row.id)).toEqual(sorted.slice(0, 20).map(row => row.id));
  expect(first.hasMore).toBe(true);
  expect((await listAnnouncements(2)).rows.map(row => row.id)).toEqual(sorted.slice(20).map(row => row.id));
  expect((await listAnnouncements(1, 3)).rows).toHaveLength(3);
  expect(await findAnnouncement("not-an-id")).toBeNull();
  expect(await findAnnouncement(randomUUID())).toBeNull();
  context.member = false;
  await expect(listAnnouncements()).rejects.toThrow("FORBIDDEN");
  await expect(findAnnouncement(values[0].id)).rejects.toThrow("FORBIDDEN");
});

it("delivers one plain-text alert with an excerpt and absolute link; edits never resend", async () => {
  const value = { ...input(), content: JSON.stringify(doc("x".repeat(600))) };
  await saveAnnouncement(value, "publish");
  const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 1, skipped: 0, failed: 0 });
  const payload: { chat_id: string; text: string } = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(payload.chat_id).toBe("101");
  expect(payload.text).toBe(announcementTelegramText(value.title, doc("x".repeat(600)), `https://example.test/announcements/${value.id}`));
  expect(payload.text).toContain("x".repeat(500));
  expect(payload.text).not.toContain("x".repeat(501));
  await saveAnnouncement({ ...value, title: "Edited" }, "edit");
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 0, failed: 0 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it("defaults Announcements on and persists opt-out; skips alerts disabled before sending", async () => {
  expect((await telegramState("recipient")).preferences.find(event => event.type === "announcement.published")?.enabled).toBe(true);
  await saveAnnouncement(input(), "publish");
  await saveTelegramPreferences("recipient", telegramEvents.map(event => ({ type: event.type, enabled: event.type !== "announcement.published" })));
  expect((await telegramState("recipient")).preferences.find(event => event.type === "announcement.published")?.enabled).toBe(false);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 1, failed: 0 });
  expect(fetcher).not.toHaveBeenCalled();
});

it("skips removed announcements and revoked member access", async () => {
  const value = input(); await saveAnnouncement(value, "publish"); await removeAnnouncement(value.id);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 1, failed: 0 });
  await saveAnnouncement(input(), "publish");
  await db.update(schema.users).set({ accountStatus: "banned" }).where(eq(schema.users.id, "recipient"));
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 1, failed: 0 });
  await db.update(schema.users).set({ accountStatus: "active" }).where(eq(schema.users.id, "recipient"));
  expect(fetcher).not.toHaveBeenCalled();
});

it("marks failed Telegram sends without retrying and skips disconnected recipients", async () => {
  await saveAnnouncement(input(), "publish");
  const fetcher = vi.fn().mockRejectedValue(new Error("network timeout")); vi.stubGlobal("fetch", fetcher);
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 0, failed: 1 });
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 0, failed: 0 });
  expect(fetcher).toHaveBeenCalledTimes(1);
  await saveAnnouncement(input(), "publish"); await disconnectTelegram("recipient");
  expect(await deliverTelegramNotifications()).toEqual({ delivered: 0, skipped: 1, failed: 0 });
});
