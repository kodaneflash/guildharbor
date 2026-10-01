"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/session";
import { announcementInputSchema } from "@/domains/announcements/validation";
import { removeAnnouncement, saveAnnouncement } from "@/domains/announcements/announcement-service";

export type AnnouncementFormState = { error: string; message: string; published?: boolean };
function refresh(id: string) {
  revalidatePath("/");
  revalidatePath("/announcements");
  revalidatePath(`/announcements/${id}`);
  revalidatePath("/admin/announcements");
}
export async function saveAnnouncementAction(operation: "publish" | "edit", _: AnnouncementFormState, form: FormData): Promise<AnnouncementFormState> {
  await requirePermission("admin.manage");
  if (operation !== "publish" && operation !== "edit") return { error: "Invalid operation.", message: "" };
  const parsed = announcementInputSchema.safeParse({ id: form.get("id"), title: form.get("title"), content: form.get("content"),
    pinned: form.get("pinned") === "on", important: form.get("important") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid announcement.", message: "" };
  const result = await saveAnnouncement({ ...parsed.data, content: JSON.stringify(parsed.data.content) }, operation);
  if ("error" in result) return { error: result.error, message: "" };
  refresh(result.id);
  return { error: "", message: operation === "publish" ? "Announcement published. Telegram alerts are queued for eligible connected members." : "Announcement saved. No additional Telegram alerts were sent.", published: operation === "publish" };
}
export async function removeAnnouncementAction(_: AnnouncementFormState, form: FormData): Promise<AnnouncementFormState> {
  await requirePermission("admin.manage");
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success || form.get("confirm") !== "on") return { error: "Confirm removal before continuing.", message: "" };
  const result = await removeAnnouncement(id.data);
  if ("error" in result) return { error: result.error, message: "" };
  refresh(result.id);
  return { error: "", message: "Announcement removed." };
}
