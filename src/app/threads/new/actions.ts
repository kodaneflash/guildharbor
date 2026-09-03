"use server";

import { eq } from "drizzle-orm";
import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createReadDatabase } from "@/db/client";
import { forums } from "@/db/schema";
import { createThread } from "@/domains/thread/thread-service";
import { enforceRateLimit } from "@/lib/rate-limit";
import { richTextDocumentSchema } from "@/lib/rich-text";
import { requireSession } from "@/lib/session";

const formSchema = z.object({
  forum: z.string().min(1).max(80),
  title: z.string().trim().min(5).max(160),
  type: z.enum(["discussion", "selling", "buying", "service"]),
  content: z.string().transform((value, context) => {
    try { return richTextDocumentSchema.parse(JSON.parse(value)); }
    catch { context.addIssue({ code: "custom", message: "Invalid post content" }); return z.NEVER; }
  }),
  lawfulAttestation: z.literal("on").optional(),
}).strict();

export async function createThreadAction(formData: FormData) {
  const session = await requireSession();
  await enforceRateLimit("thread", session.user.id);
  const input = formSchema.parse(Object.fromEntries(formData));
  if (["selling", "buying", "service"].includes(input.type) && input.lawfulAttestation !== "on") throw new Error("Marketplace attestation is required");
  const database = createReadDatabase();
  const [forum] = await database.select({ id: forums.id }).from(forums).where(eq(forums.slug, input.forum)).limit(1);
  if (!forum) throw new Error("Forum not found");
  const thread = await createThread({ actorId: session.user.id, forumId: forum.id, title: input.title, type: input.type, content: input.content });
  updateTag(`forum:${forum.id}`);
  redirect(`/threads/${thread.id}/${thread.slug}`);
}
