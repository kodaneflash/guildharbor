"use server";
import { redirect } from "next/navigation";
import { replyToThread } from "@/domains/thread/thread-service";
import { requireMember } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function replyAction(
  threadId: number,
  _: { error: string },
  form: FormData,
) {
  const access = await requireMember();
  const content = String(form.get("content") ?? "").trim();
  if (!content || content.length > 20000)
    return { error: "Reply must contain 1–20,000 characters." };
  if (!Number.isSafeInteger(threadId) || threadId < 1)
    return { error: "Invalid thread." };
  await enforceRateLimit("thread", access.user.id);
  const post = await replyToThread(threadId, content);
  redirect(
    `/threads/${threadId}/${post.slug}?page=${post.page}#post-${post.id}`,
  );
}
