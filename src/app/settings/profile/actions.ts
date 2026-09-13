"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireMember } from "@/lib/session";
const schema = z.object({
  displayName: z.string().trim().min(1).max(80),
  telegramHandle: z
    .string()
    .trim()
    .max(33)
    .regex(/^@?[a-zA-Z0-9_]*$/),
  bio: z.string().trim().max(1500),
});
export async function saveProfile(_: { message: string }, form: FormData) {
  const access = await requireMember();
  const input = schema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      message:
        "Check your profile fields. Display names are required; Telegram handles may contain letters, numbers and underscores.",
    };
  await createReadDatabase()
    .update(profiles)
    .set(input.data)
    .where(eq(profiles.userId, access.user.id));
  revalidatePath("/settings/profile");
  revalidatePath(`/members/${access.user.username}`);
  return { message: "Profile saved." };
}
