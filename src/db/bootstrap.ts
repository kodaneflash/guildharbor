import { and, eq, isNotNull } from "drizzle-orm";
import { withTransaction } from "@/db/transaction";
import {
  categories,
  forums,
  roles,
  userRoles,
  users,
  moderationActions,
} from "@/db/schema";
const email = process.argv[2];
if (!email)
  throw new Error("Usage: bun run db:bootstrap verified-admin@example.com");
await withTransaction(async (database) => {
  const [user] = await database
    .select()
    .from(users)
    .where(
      and(
        eq(users.email, email),
        eq(users.emailVerified, true),
        isNotNull(users.username),
        eq(users.accountStatus, "active"),
      ),
    )
    .limit(1);
  if (!user)
    throw new Error(
      "Register, select a username and verify this administrator email first.",
    );
  const [role] = await database
    .insert(roles)
    .values({
      key: "admin",
      name: "Administrator",
      permissions: ["admin.manage"],
    })
    .onConflictDoUpdate({
      target: roles.key,
      set: { permissions: ["admin.manage"] },
    })
    .returning({ id: roles.id });
  await database
    .insert(userRoles)
    .values({ userId: user.id, roleId: role.id })
    .onConflictDoNothing();
  await database
    .update(users)
    .set({ membershipStatus: "approved" })
    .where(eq(users.id, user.id));
  await database
    .insert(moderationActions)
    .values({
      actorId: user.id,
      subjectUserId: user.id,
      action: "registration.bootstrap",
      reason: "Administrator bootstrapped by operator",
    });
  await database
    .insert(categories)
    .values({ slug: "community", title: "Community" })
    .onConflictDoNothing();
  const [category] = await database
    .select()
    .from(categories)
    .where(eq(categories.slug, "community"))
    .limit(1);
  await database
    .insert(forums)
    .values({
      categoryId: category.id,
      slug: "general",
      title: "General Discussion",
      description: "Community conversations.",
      icon: "MessagesSquare",
    })
    .onConflictDoNothing();
});
console.info("Administrator approved and forum initialized.");
