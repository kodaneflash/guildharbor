import { sql, eq, and, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { OutlawNavbarClient } from "@/components/outlaw-navbar-client";
import { createReadDatabase } from "@/db/client";
import { cartItems, notifications } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getAccess } from "@/lib/session";

export async function signOut() {
  "use server";

  if (auth) await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

export async function OutlawNavbar() {
  const access = await getAccess();
  if (!access.allowed || !access.user?.username) {
    return <OutlawNavbarClient isAuthenticated={Boolean(access.session)} signOutAction={access.session ? signOut : undefined} />;
  }

  const database = createReadDatabase();
  const [[cart], [unread]] = await Promise.all([
    database.select({ count: sql<number>`count(*)::int` }).from(cartItems).where(eq(cartItems.userId, access.user.id)),
    database.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, access.user.id), isNull(notifications.readAt))),
  ]);
  return (
    <OutlawNavbarClient
      isAuthenticated
      signOutAction={signOut}
      account={{
        username: access.user.username,
        cartCount: cart?.count ?? 0,
        unreadCount: unread?.count ?? 0,
        admin: access.permissions.includes("admin.manage"),
      }}
    />
  );
}
