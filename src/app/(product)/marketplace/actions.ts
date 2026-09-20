"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { enrollSeller, modifySelection, saveListing } from "@/domains/commerce/commerce-service";
import { listingSchema, sellerSchema } from "@/domains/commerce/validation";
import { requireMember } from "@/lib/session";
export async function sellerAction(_: { message: string }, form: FormData) {
  await requireMember(); const input = sellerSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { message: input.error.issues.map(issue => issue.message).join(" ") };
  await enrollSeller(input.data); revalidatePath("/seller"); revalidatePath("/"); redirect("/seller");
}
export async function listingAction(_: { message: string }, form: FormData) {
  await requireMember();
  const raw = { ...Object.fromEntries(form), available: form.get("available") === "on" };
  const validated = listingSchema.safeParse(raw);
  if (!validated.success) return { message: validated.error.issues.map(issue => issue.message).join(" ") };
  // The service parses the original price string into exact integer cents once.
  const result = await saveListing(raw);
  if (result.error) return { message: result.error };
  revalidatePath("/marketplace"); revalidatePath("/"); revalidatePath("/seller/listings"); redirect("/seller/listings");
}
export async function selectionAction(_: { message: string }, form: FormData) {
  await requireMember();
  const input = z.object({ id: z.uuid(), operation: z.enum(["cart.add", "cart.remove", "favorite.add", "favorite.remove"]) }).safeParse(Object.fromEntries(form));
  if (!input.success) return { message: "Invalid selection." };
  const result = await modifySelection(input.data.id, input.data.operation);
  if (result?.error) return { message: result.error };
  revalidatePath("/", "layout"); return { message: input.data.operation.endsWith("remove") ? "Removed." : "Saved to your account." };
}
