import { communityMemberFilter } from "@/lib/community-access";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { communityNotice } from "@/components/access-notice";
import { UserAvatar } from "@/components/user-avatar";
import { createReadDatabase } from "@/db/client";
import { profiles, users } from "@/db/schema";
import { pageNumber } from "@/db/queries/community";
export default async function MembersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const notice = await communityNotice();
  if (notice) return notice;
  const page = pageNumber((await searchParams).page);
  const members = await createReadDatabase()
    .select({
      id: users.id,
      username: users.username,
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(communityMemberFilter())
    .orderBy(asc(users.username))
    .limit(50)
    .offset((page - 1) * 50);
  return (
    <div className="site-container space-y-6 py-8">
      <h1 className="text-display-sm font-extrabold">Members</h1>
      <section className="surface divide-y divide-border">
        {members.map((member) => (
          <Link
            key={member.id}
            className="flex items-center gap-4 p-5 hover:bg-panel-raised"
            href={`/members/${member.username}`}
          >
            <UserAvatar
              seed={member.username!}
              src={member.avatarUrl ?? undefined}
            />
            <div>
              <strong>{member.displayName || member.username}</strong>
              <p className="text-body-xs text-text-muted">@{member.username}</p>
            </div>
          </Link>
        ))}
        {!members.length && (
          <p className="p-8 text-text-muted">No members on this page.</p>
        )}
      </section>
      <nav className="flex gap-3" aria-label="Pagination">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {members.length === 50 && <Link href={`?page=${page + 1}`}>Next</Link>}
      </nav>
    </div>
  );
}
