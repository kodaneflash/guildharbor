import "server-only";
import { eq } from "drizzle-orm";
import { profiles, users } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { requireMember } from "@/lib/session";
import { hasCommunityAccess } from "@/lib/community-access";
import { profilePreferencesSchema } from "./preferences";

export async function updateProfilePreferences(input: unknown) {
  const access = await requireMember();
  const data = profilePreferencesSchema.parse(input);
  await withTransaction(async database => {
    const [actor] = await database.select().from(users).where(eq(users.id, access.user.id)).for("share");
    if (!hasCommunityAccess(actor ?? null)) throw new Error("FORBIDDEN");
    const updated = await database.update(profiles).set({ ...data, updatedAt: new Date() }).where(eq(profiles.userId, access.user.id)).returning({ id: profiles.userId });
    if (!updated.length) throw new Error("Account profile is missing");
  });
  return access.user.username;
}
