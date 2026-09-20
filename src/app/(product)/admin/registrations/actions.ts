"use server";
import { transactionActor } from "@/domains/authorization";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { users, moderationActions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { requirePermission } from "@/lib/session";
const reviewSchema = z.object({
  userId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
});
export async function reviewRegistration(formData: FormData) {
  const actor = await requirePermission("admin.manage");
  const { userId, decision } = reviewSchema.parse(Object.fromEntries(formData));
  await withTransaction(async (database) => {
    const current = await transactionActor(database, actor.user.id);
    if (!current.permissions.includes("admin.manage")) throw new Error("FORBIDDEN");
    const [updated] = await database
      .update(users)
      .set({ membershipStatus: decision })
      .where(and(eq(users.id, userId), eq(users.membershipStatus, "pending")))
      .returning({ id: users.id });
    if (!updated) return;
    await database
      .insert(moderationActions)
      .values({
        actorId: actor.user.id,
        subjectUserId: userId,
        action: `registration.${decision}`,
        reason: "Administrator registration review",
      });
  });
  revalidatePath("/admin/registrations");
}
