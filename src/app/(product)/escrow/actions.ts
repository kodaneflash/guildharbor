"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { draftSchema, saveDealDraft, transitionDeal } from "@/domains/deals/deal-service";
export async function draftAction(_: { message: string }, form: FormData) {
  const raw = Object.fromEntries(form); const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { message: parsed.error.issues.map(issue => issue.message).join(" ") };
  const result = await saveDealDraft(raw); if (result.error) return { message: result.error }; redirect(`/escrow/${result.id}`);
}
export async function dealAction(_: { message: string }, form: FormData) {
  const result = await transitionDeal(Object.fromEntries(form)); revalidatePath("/escrow", "layout"); return { message: result.error ?? `Agreement is now ${result.state}.` };
}
