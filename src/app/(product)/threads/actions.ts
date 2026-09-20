"use server";
import { revalidatePath } from "next/cache";
import { forumOperationSchema, operateForum } from "@/domains/thread/forum-operations";
import { requireMember } from "@/lib/session";
export async function forumAction(_: { message: string }, form: FormData) {
  await requireMember();
  const input = forumOperationSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { message: input.error.issues.map(issue => issue.message).join(" ") };
  const result = await operateForum(input.data);
  revalidatePath(result.href);
  revalidatePath("/forums");
  return { message: result.message };
}
