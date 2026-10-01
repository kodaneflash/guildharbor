import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { telegramConnections, telegramLinkTokens, telegramPreferences, users } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { env } from "@/lib/env";
import { requireMember } from "@/lib/session";

export const telegramEvents = [
  { type: "announcement.published", label: "Announcements" },
  { type: "message.received", label: "New private message" },
  { type: "thread.reply", label: "Subscribed thread reply" },
  { type: "deal.updated", label: "Agreement update (before funding)" },
  { type: "support.updated", label: "Support case update" },
] as const;
export type TelegramEvent = (typeof telegramEvents)[number]["type"];
const eventType = z.enum(telegramEvents.map(event => event.type));
const telegramId = z.string().regex(/^[1-9]\d{0,18}$/).transform(value => BigInt(value)).refine(value => value <= 9223372036854775807n);
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function bridgeAuthorized(value: string | null) {
  if (!env.TELEGRAM_NOTIFICATIONS_ENABLED || !env.TELEGRAM_BRIDGE_SECRET || !value?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(value.slice(7));
  const expected = Buffer.from(env.TELEGRAM_BRIDGE_SECRET);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function telegramState(userId: string) {
  const database = createReadDatabase();
  const [connection, preferences] = await Promise.all([
    database.select({ userId: telegramConnections.userId }).from(telegramConnections).where(eq(telegramConnections.userId, userId)).limit(1),
    database.select().from(telegramPreferences).where(eq(telegramPreferences.userId, userId)),
  ]);
  return { connected: Boolean(connection[0]), preferences: telegramEvents.map(event => ({ ...event, enabled: preferences.find(preference => preference.eventType === event.type)?.enabled ?? true })) };
}

export async function createTelegramLink() {
  const { user } = await requireMember();
  if (!env.TELEGRAM_NOTIFICATIONS_ENABLED || !env.TELEGRAM_BOT_USERNAME || !env.TELEGRAM_BRIDGE_SECRET) throw new Error("Telegram linking is not configured");
  const token = randomBytes(32).toString("base64url");
  const state = await telegramState(user.id);
  if (state.connected) return { error: "Telegram is already connected." };
  const expiresAt = new Date(Date.now() + 10 * 60_000);
  await createReadDatabase().insert(telegramLinkTokens).values({ userId: user.id, tokenHash: hashToken(token), expiresAt }).onConflictDoUpdate({ target: telegramLinkTokens.userId, set: { tokenHash: hashToken(token), expiresAt } });
  return { link: `https://t.me/${env.TELEGRAM_BOT_USERNAME}?start=${token}` };
}

export async function redeemTelegramLink(input: unknown) {
  const data = z.object({ token: z.string().regex(tokenPattern), telegramUserId: telegramId, privateChatId: telegramId }).safeParse(input);
  if (!data.success || data.data.telegramUserId !== data.data.privateChatId) return { status: "invalid" as const };
  return withTransaction(async tx => {
    const [link] = await tx.select().from(telegramLinkTokens).where(and(eq(telegramLinkTokens.tokenHash, hashToken(data.data.token)), gt(telegramLinkTokens.expiresAt, new Date()))).for("update").limit(1);
    if (!link) return { status: "expired" as const };
    const [connection] = await tx.insert(telegramConnections).values({ userId: link.userId, telegramUserId: data.data.telegramUserId, privateChatId: data.data.privateChatId }).onConflictDoNothing().returning({ userId: telegramConnections.userId });
    if (!connection) return { status: "conflict" as const };
    await tx.delete(telegramLinkTokens).where(eq(telegramLinkTokens.userId, link.userId));
    const [user] = await tx.select({ username: users.username }).from(users).where(eq(users.id, link.userId)).limit(1);
    return { status: "connected" as const, username: user?.username ?? null };
  });
}

export async function telegramConnectionById(value: string) {
  const id = telegramId.safeParse(value);
  if (!id.success) return { status: "invalid" as const };
  const [connection] = await createReadDatabase().select({ username: users.username }).from(telegramConnections).innerJoin(users, eq(users.id, telegramConnections.userId)).where(and(eq(telegramConnections.telegramUserId, id.data), eq(telegramConnections.privateChatId, id.data))).limit(1);
  return connection ? { status: "connected" as const, username: connection.username } : { status: "not_connected" as const };
}

export async function disconnectTelegram(userId: string) {
  await withTransaction(async tx => {
    await tx.delete(telegramLinkTokens).where(eq(telegramLinkTokens.userId, userId));
    await tx.delete(telegramConnections).where(eq(telegramConnections.userId, userId));
  });
}

export async function disconnectTelegramById(value: string) {
  const id = telegramId.safeParse(value);
  if (!id.success) return false;
  const [connection] = await createReadDatabase().select({ userId: telegramConnections.userId }).from(telegramConnections).where(and(eq(telegramConnections.telegramUserId, id.data), eq(telegramConnections.privateChatId, id.data))).limit(1);
  if (!connection) return false;
  await disconnectTelegram(connection.userId);
  return true;
}

export async function saveTelegramPreferences(userId: string, input: unknown) {
  const data = z.array(z.object({ type: eventType, enabled: z.boolean() })).length(telegramEvents.length).parse(input);
  if (new Set(data.map(item => item.type)).size !== telegramEvents.length) throw new Error("Invalid preferences");
  await withTransaction(async tx => {
    const [connection] = await tx.select().from(telegramConnections).where(eq(telegramConnections.userId, userId)).for("update").limit(1);
    if (!connection) throw new Error("Telegram is not connected");
    for (const item of data) await tx.insert(telegramPreferences).values({ userId, eventType: item.type, enabled: item.enabled }).onConflictDoUpdate({ target: [telegramPreferences.userId, telegramPreferences.eventType], set: { enabled: item.enabled } });
  });
}
