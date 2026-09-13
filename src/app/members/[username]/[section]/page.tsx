import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { communityNotice } from "@/components/access-notice";
import { ThreadRow } from "@/components/thread-row";
import { resolvePublicProfile } from "@/db/resolve-profile";
import { availableForums, communityThreads } from "@/db/queries/community";
import { createReadDatabase } from "@/db/client";
import { posts, threads, reputationEvents, vouches } from "@/db/schema";
export const metadata = { title: "Member activity" };
export default async function MemberSection({
  params,
}: {
  params: Promise<{ username: string; section: string }>;
}) {
  const notice = await communityNotice();
  if (notice) return notice;
  const { username, section } = await params;
  if (
    ![
      "threads",
      "posts",
      "reputation",
      "vouches",
      "about",
      "activity",
    ].includes(section)
  )
    notFound();
  const profile = await resolvePublicProfile(username);
  if (!profile) notFound();
  const database = createReadDatabase();
  const ids = (await availableForums()).map(({ forum }) => forum.id);
  let content;
  if (section === "threads" || section === "activity") {
    const rows = await communityThreads({ creatorId: profile.uid });
    content = rows.length ? (
      rows.map((thread) => <ThreadRow key={thread.id} thread={thread} />)
    ) : (
      <p>No visible threads.</p>
    );
  } else if (section === "posts") {
    const rows = ids.length
      ? await database
          .select({
            id: posts.id,
            text: posts.plainText,
            threadId: threads.id,
            slug: threads.slug,
          })
          .from(posts)
          .innerJoin(threads, eq(threads.id, posts.threadId))
          .where(
            and(
              eq(posts.authorId, profile.uid),
              inArray(threads.forumId, ids),
              isNull(threads.deletedAt),
              isNull(posts.deletedAt),
            ),
          )
          .orderBy(desc(posts.id))
          .limit(30)
      : [];
    content = rows.length ? (
      rows.map((post) => (
        <Link
          key={post.id}
          className="surface block p-5"
          href={`/threads/${post.threadId}/${post.slug}`}
        >
          <p className="whitespace-pre-wrap">{post.text}</p>
        </Link>
      ))
    ) : (
      <p>No visible posts.</p>
    );
  } else if (section === "about")
    content = <p>{profile.about || "No biography provided."}</p>;
  else {
    // Feedback text may reference a private subforum; only show records with visible context.
    const rows =
      section === "reputation"
        ? await database
            .select({
              id: reputationEvents.id,
              text: reputationEvents.reason,
              threadId: reputationEvents.threadId,
            })
            .from(reputationEvents)
            .where(eq(reputationEvents.recipientId, profile.uid))
            .orderBy(desc(reputationEvents.id))
            .limit(30)
        : await database
            .select({
              id: vouches.id,
              text: vouches.comment,
              threadId: vouches.threadId,
            })
            .from(vouches)
            .where(
              and(
                eq(vouches.recipientId, profile.uid),
                eq(vouches.status, "actioned"),
              ),
            )
            .orderBy(desc(vouches.id))
            .limit(30);
    const visibleThreads = ids.length
      ? await database
          .select({ id: threads.id })
          .from(threads)
          .where(and(inArray(threads.forumId, ids), isNull(threads.deletedAt)))
      : [];
    const visible = new Set(visibleThreads.map((thread) => thread.id));
    const items = rows.filter(
      (row) => row.threadId !== null && visible.has(row.threadId),
    );
    content = items.length ? (
      items.map((row) => (
        <p className="surface p-5" key={row.id}>
          {row.text}
        </p>
      ))
    ) : (
      <p>No visible feedback.</p>
    );
  }
  return (
    <div className="site-container space-y-5 py-8">
      <Link href={`/members/${profile.username}`} className="text-category">
        {profile.displayName}
      </Link>
      <h1 className="text-3xl font-extrabold capitalize">{section}</h1>
      {content}
    </div>
  );
}
