import { z } from "zod";

export const usernameSchema = z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/).transform((value) => value.toLowerCase());
export const localRedirectSchema = z.string().startsWith("/").refine((value) => !value.startsWith("//") && !value.includes("\\"), "Unsafe redirect");
export const threadInputSchema = z.object({
  forumId: z.number().int().positive(),
  title: z.string().trim().min(5).max(160),
  type: z.enum(["discussion", "selling", "buying", "service", "announcement"]),
  content: z.object({ type: z.literal("doc"), content: z.array(z.object({ type: z.string() }).passthrough()).max(500) }).strict(),
}).strict();

export const messageInputSchema = z.object({
  conversationId: z.uuid(),
  clientRequestId: z.uuid(),
  content: z.string().trim().min(1).max(10_000),
  replyToMessageId: z.number().int().positive().optional(),
  attachmentIds: z.array(z.uuid()).max(4).default([]),
}).strict();
