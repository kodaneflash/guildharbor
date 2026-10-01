import { telegramState } from "@/domains/notifications/telegram";
import { requireMember } from "@/lib/session";
import { env } from "@/lib/env";

export async function GET() {
  const { user } = await requireMember();
  if (!env.TELEGRAM_NOTIFICATIONS_ENABLED) return Response.json({ error: "Telegram notifications are unavailable" }, { status: 503 });
  return Response.json(await telegramState(user.id), { headers: { "Cache-Control": "private, no-store" } });
}
