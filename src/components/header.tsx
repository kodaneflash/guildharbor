import { eq } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { getAccess } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
export async function Header() {
  const access = await getAccess();
  if (!access.allowed || !access.user?.username)
    return <AppHeader account={null} signedIn={Boolean(access.session)} />;
  const [profile] = await createReadDatabase()
    .select({ avatarUrl: profiles.avatarUrl })
    .from(profiles)
    .where(eq(profiles.userId, access.user.id))
    .limit(1);
  return (
    <AppHeader
      signedIn
      account={{
        username: access.user.username,
        avatarUrl: profile?.avatarUrl ?? undefined,
        admin: access.permissions.includes("admin.manage"),
      }}
    />
  );
}
