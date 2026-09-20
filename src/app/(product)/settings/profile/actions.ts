"use server";
import { revalidatePath } from "next/cache";
import { requireMember } from "@/lib/session";
import { profilePreferencesSchema } from "@/domains/account/preferences";
import { updateProfilePreferences } from "@/domains/account/account-service";

export async function saveProfile(_: { message: string }, form: FormData) {
  await requireMember();
  const input = profilePreferencesSchema.safeParse({ ...Object.fromEntries(form), showTelegram: form.get("showTelegram") === "on", showDiscord: form.get("showDiscord") === "on", showLastSeen: form.get("showLastSeen") === "on" });
  if (!input.success) return { message: input.error.issues.map(issue => issue.message).join(" ") };
  const username = await updateProfilePreferences(input.data);
  revalidatePath("/", "layout");
  revalidatePath(`/members/${username}`);
  return { message: "Profile and preferences saved." };
}
