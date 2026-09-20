"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { conversationOperation, sendMessage, sendMessageSchema, startConversation } from "@/domains/messaging/message-service";
export async function composeAction(_: { message?: string }, form: FormData) {
  const result = await startConversation(form.get("username"));
  if ("error" in result) return { message: result.error };
  redirect(`/messages/${result.id}`);
}
export async function sendAction(_: { message: string; sent: boolean }, form: FormData) {
  const input = sendMessageSchema.safeParse({ ...Object.fromEntries(form), replyToId: form.get("replyToId") || undefined });
  if (!input.success) return { message: "Enter a message of 1–20,000 characters and a valid reply reference.", sent: false };
  const result = await sendMessage(input.data);
  revalidatePath(`/messages/${input.data.conversationId}`);
  return { message: result.error ?? "Message sent.", sent: !result.error };
}
export async function conversationAction(_: { message?: string }, form: FormData) {
  await conversationOperation({ ...Object.fromEntries(form), messageId: form.get("messageId") || undefined });
  revalidatePath("/messages", "layout"); return { message: "Conversation updated." };
}
