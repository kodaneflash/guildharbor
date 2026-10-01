// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "@/db/schema";

const context = vi.hoisted(() => ({ db: null as unknown, userId: "member-1" }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({ env: { TELEGRAM_NOTIFICATIONS_ENABLED: true, TELEGRAM_BOT_USERNAME: "GuildHarborBot", TELEGRAM_BRIDGE_SECRET: "long-test-secret-that-is-at-least-32-characters" } }));
vi.mock("@/lib/session", () => ({ requireMember: async () => ({ user: { id: context.userId } }) }));
vi.mock("@/db/client", () => ({ createReadDatabase: () => context.db }));
vi.mock("@/db/transaction", () => ({ withTransaction: (operation: (tx: unknown) => Promise<unknown>) => (context.db as ReturnType<typeof drizzle>).transaction(operation) }));

import { createTelegramLink, disconnectTelegram, redeemTelegramLink, saveTelegramPreferences, telegramState, telegramConnectionById } from "./telegram";

let pg: PGlite;
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    CREATE TABLE users (id text PRIMARY KEY, username text);
    INSERT INTO users VALUES ('member-1', 'ace'), ('member-2', 'other');
    CREATE TABLE telegram_connections (user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, telegram_user_id bigint NOT NULL UNIQUE, private_chat_id bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE telegram_link_tokens (token_hash text PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE telegram_preferences (user_id text NOT NULL REFERENCES telegram_connections(user_id) ON DELETE CASCADE, event_type text NOT NULL, enabled boolean NOT NULL DEFAULT true, PRIMARY KEY (user_id, event_type));
  `);
  context.db = drizzle(pg, { schema });
});
afterAll(async () => pg.close());

describe("Telegram account ownership", () => {
  it("uses expiring, single-use tokens and a unique verified Telegram identity", async () => {
    const link = await createTelegramLink();
    expect("link" in link && link.link).toBeTruthy();
    const token = new URL(link.link!).searchParams.get("start")!;
    expect(token).toHaveLength(43);
    const stored = await pg.query<{ token_hash: string }>("SELECT token_hash FROM telegram_link_tokens");
    expect(stored.rows[0]?.token_hash).not.toBe(token);
    expect(await redeemTelegramLink({ token, telegramUserId: "9007199254740991", privateChatId: "1" })).toEqual({ status: "invalid" });
    expect(await redeemTelegramLink({ token, telegramUserId: "9007199254740991", privateChatId: "9007199254740991" })).toEqual({ status: "connected", username: "ace" });
    expect(await redeemTelegramLink({ token, telegramUserId: "9007199254740991", privateChatId: "9007199254740991" })).toEqual({ status: "expired" });
    expect((await telegramState("member-1")).connected).toBe(true);
    expect((await telegramState("member-1")).preferences.find(item => item.type === "announcement.published")?.enabled).toBe(true);
    expect(await telegramConnectionById("9007199254740991")).toEqual({ status: "connected", username: "ace" });
    await saveTelegramPreferences("member-1", [
      { type: "announcement.published", enabled: true }, { type: "message.received", enabled: false }, { type: "thread.reply", enabled: true },
      { type: "deal.updated", enabled: true }, { type: "support.updated", enabled: true },
    ]);
    expect((await telegramState("member-1")).preferences.find(item => item.type === "message.received")?.enabled).toBe(false);
    context.userId = "member-2";
    const second = await createTelegramLink();
    const secondToken = new URL(second.link!).searchParams.get("start")!;
    expect(await redeemTelegramLink({ token: secondToken, telegramUserId: "9007199254740991", privateChatId: "9007199254740991" })).toEqual({ status: "conflict" });
    await disconnectTelegram("member-1");
    expect((await telegramState("member-1")).connected).toBe(false);
    expect(await redeemTelegramLink({ token: secondToken, telegramUserId: "9007199254740991", privateChatId: "9007199254740991" })).toEqual({ status: "connected", username: "other" });
    context.userId = "member-1";
    const expired = await createTelegramLink();
    const expiredToken = new URL(expired.link!).searchParams.get("start")!;
    await pg.exec("UPDATE telegram_link_tokens SET expires_at = now() - interval '1 second' WHERE user_id = 'member-1'");
    expect(await redeemTelegramLink({ token: expiredToken, telegramUserId: "42", privateChatId: "42" })).toEqual({ status: "expired" });
  });
});
