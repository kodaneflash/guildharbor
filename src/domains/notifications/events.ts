import "server-only";
import { and, eq } from "drizzle-orm";
import type { DatabaseTransaction } from "@/db/transaction";
import { notificationOutbox, notificationPreferences, notifications, telegramOutbox } from "@/db/schema";
import { telegramEvents } from "@/domains/notifications/telegram";
import { env } from "@/lib/env";
export async function notifyMember(tx: DatabaseTransaction, event: { userId: string; actorId: string; type: string; resourceType: string; resourceId: string; eventKey: string; title: string; href: string }) {
  const [notification] = await tx.insert(notifications).values(event).onConflictDoNothing({ target: notifications.eventKey }).returning({ id: notifications.id });
  if (!notification) return;
  const [preferences] = await tx.select().from(notificationPreferences).where(and(eq(notificationPreferences.userId, event.userId), eq(notificationPreferences.eventType, event.type)));
  if (preferences?.email) await tx.insert(notificationOutbox).values({ notificationId: notification.id });
  if (env.TELEGRAM_NOTIFICATIONS_ENABLED && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BRIDGE_SECRET && telegramEvents.some(item => item.type === event.type)) await tx.insert(telegramOutbox).values({ notificationId: notification.id });
}
