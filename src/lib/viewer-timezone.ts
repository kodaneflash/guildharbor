import "server-only";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
import { requireMember } from "@/lib/session";
export const viewerTimezone = cache(async () => {
  const access = await requireMember();
  const [profile] = await createReadDatabase().select({ timezone: profiles.timezone }).from(profiles).where(eq(profiles.userId, access.user.id));
  if (!profile) throw new Error("Account profile is missing");
  return profile.timezone;
});
