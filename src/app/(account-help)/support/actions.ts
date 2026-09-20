"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createCase, updateCase, claimCase } from "@/domains/support/support-service";
export async function createCaseAction(_: { message: string }, form: FormData): Promise<{ message: string }> {
  const id = await createCase({ ...Object.fromEntries(form), dealId: form.get("dealId") || undefined, conversationId: form.get("conversationId") || undefined }); redirect(`/support/cases/${id}`);
}
export async function updateCaseAction(_: { message: string }, form: FormData) { await updateCase(Object.fromEntries(form)); revalidatePath(`/support/cases/${String(form.get("id"))}`); return { message: "Case updated." }; }
export async function claimCaseAction(form: FormData) { const id = String(form.get("id")); await claimCase(id); redirect(`/support/cases/${id}`); }
