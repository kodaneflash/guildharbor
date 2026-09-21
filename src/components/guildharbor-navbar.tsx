import { sql, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { GuildHarborNavbarClient } from "@/components/guildharbor-navbar-client";
import { createReadDatabase } from "@/db/client";
import { cartItems } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAccess } from "@/lib/session";

export async function signOut() {
  "use server";

  if (auth) await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function GuildHarborNavbar() {
  const access = await getAccess();
  if (!access.allowed || !access.user?.username) {
    return <GuildHarborNavbarClient isAuthenticated={Boolean(access.session)} signOutAction={access.session ? signOut : undefined} />;
  }

  const database = createReadDatabase();
  const [cart] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(cartItems)
    .where(eq(cartItems.userId, access.user.id));
  return (
    <GuildHarborNavbarClient
      isAuthenticated
      signOutAction={signOut}
      account={{
        username: access.user.username,
        cartCount: cart?.count ?? 0,
        admin: access.permissions.includes("admin.manage"),
      }}
    />
  );
}
