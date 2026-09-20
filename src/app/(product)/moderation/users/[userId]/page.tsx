import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { staffNotice } from "@/components/access-notice";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { users } from "@/db/schema";
export default async function ReviewUser({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const notice = await staffNotice("moderation.review");
  if (notice) return notice;
  await requirePermission("moderation.review");
  const [user] = await createReadDatabase()
    .select({
      username: users.username,
      status: users.accountStatus,
      membership: users.membershipStatus,
    })
    .from(users)
    .where(eq(users.id, (await params).userId))
    .limit(1);
  if (!user) notFound();
  return (
    <div className="site-container py-8">
      <section className="surface space-y-4 p-6">
        <h1 className="text-heading-xl font-bold">Member review</h1>
        <p>{user.username}</p>
        <p>Account: {user.status}</p>
        <p>Registration: {user.membership}</p>
      </section>
    </div>
  );
}
