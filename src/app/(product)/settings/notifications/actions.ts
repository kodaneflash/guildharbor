"use server";
import { revalidatePath } from "next/cache";
import { notificationTypes, readNotification, saveNotificationPreferences } from "@/domains/notifications/notification-service";
export async function preferenceAction(_: { message: string }, form: FormData) { await saveNotificationPreferences(notificationTypes.map(eventType => ({ eventType, inApp: form.get(`${eventType}.inApp`) === "on", email: form.get(`${eventType}.email`) === "on" }))); revalidatePath("/settings/notifications"); revalidatePath("/notifications"); return { message: "Notification preferences saved." }; }
export async function notificationReadAction(form: FormData) { await readNotification(Number(form.get("id"))); revalidatePath("/notifications"); }
