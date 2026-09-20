import { eq, sql } from "drizzle-orm";
import { AppHeader } from "@/components/app-header";
import { getAccess } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { profiles, cartItems } from "@/db/schema";
export async function Header() {
  const access = await getAccess();
  if (!access.allowed || !access.user?.username)
    return <AppHeader account={null} signedIn={Boolean(access.session)} />;
  const [[profile], [cart]] = await Promise.all([
    createReadDatabase().select({ avatarUrl: profiles.avatarUrl }).from(profiles).where(eq(profiles.userId, access.user.id)).limit(1),
    createReadDatabase().select({ count: sql<number>`count(*)::int` }).from(cartItems).where(eq(cartItems.userId, access.user.id)),
  ]);
  return (
    <AppHeader
      cartCount={cart.count}
      signedIn
      account={{
        username: access.user.username,
        avatarUrl: profile?.avatarUrl ?? undefined,
        admin: access.permissions.includes("admin.manage"),
      }}
    />
  );
}
