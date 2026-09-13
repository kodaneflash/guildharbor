import { desc, eq } from "drizzle-orm";
import { communityNotice } from "@/components/access-notice";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { notifications } from "@/db/schema";
import { findThread, findForum } from "@/db/queries/community";
import Link from "next/link";
export default async function NotificationsPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await requireMember();
  const rows = await createReadDatabase()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, access.user.id))
    .orderBy(desc(notifications.id))
    .limit(50);
  const visible = [];
  for (const row of rows) {
    const thread = /^\/threads\/(\d+)\//.exec(row.href);
    const forum = /^\/forums\/([^/?#]+)$/.exec(row.href);
    if (
      (thread && (await findThread(Number(thread[1])))) ||
      (forum && (await findForum(forum[1])))
    )
      visible.push(row);
  }
  return (
    <div className="site-container max-w-4xl space-y-6 py-8">
      <h1 className="text-3xl font-extrabold">Notifications</h1>
      <section className="surface divide-y divide-border">
        {visible.map((row) => (
          <Link key={row.id} className="block p-5" href={row.href}>
            <strong>{row.title}</strong>
            <p className="mt-2 text-xs text-text-muted">
              {row.createdAt.toISOString()}
            </p>
          </Link>
        ))}
        {!visible.length && (
          <p className="p-8 text-text-muted">No notifications.</p>
        )}
      </section>
    </div>
  );
}
