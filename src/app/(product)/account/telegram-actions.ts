"use server";
import { revalidatePath } from "next/cache";
import { createTelegramLink, disconnectTelegram, saveTelegramPreferences, telegramEvents } from "@/domains/notifications/telegram";
import { requireMember } from "@/lib/session";

export async function createTelegramLinkAction() {
  return createTelegramLink();
}
export async function saveTelegramPreferencesAction(form: FormData) {
  const { user } = await requireMember();
  await saveTelegramPreferences(user.id, telegramEvents.map(event => ({ type: event.type, enabled: form.get(event.type) === "on" })));
  revalidatePath("/account");
}
export async function disconnectTelegramAction() {
  const { user } = await requireMember();
  await disconnectTelegram(user.id);
  revalidatePath("/account");
}
