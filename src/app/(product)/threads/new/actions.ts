"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createThread } from "@/domains/thread/thread-service";
import { findForum } from "@/db/queries/community";
import { enforceRateLimit } from "@/lib/rate-limit";
import { richTextDocumentSchema } from "@/lib/rich-text";
import { requireMember } from "@/lib/session";
const formSchema = z.object({
  forum: z.string().min(1).max(80),
  title: z.string().trim().min(5).max(160),
  content: z
    .string()
    .max(200000)
    .transform((value, context) => {
      try {
        return richTextDocumentSchema.parse(JSON.parse(value));
      } catch {
        context.addIssue({ code: "custom", message: "Invalid post content" });
        return z.NEVER;
      }
    }),
});
export async function createThreadAction(
  _: { error: string },
  formData: FormData,
) {
  const access = await requireMember();
  const parsed = formSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      error: "Enter a title of 5–160 characters and valid post content.",
    };
  const input = parsed.data;
  await enforceRateLimit("thread", access.user.id);
  const forum = await findForum(input.forum);
  if (!forum) return { error: "Forum is unavailable." };
  const thread = await createThread({
    actorId: access.user.id,
    forumId: forum.id,
    title: input.title,
    type: "discussion",
    content: input.content,
  });
  redirect(`/threads/${thread.id}/${thread.slug}`);
}
