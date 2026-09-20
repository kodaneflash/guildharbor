import Link from "next/link";
import { notFound } from "next/navigation";
import { communityNotice } from "@/components/access-notice";
import { ThreadRow } from "@/components/thread-row";
import {
  findForum,
  communityThreads,
  pageNumber,
} from "@/db/queries/community";
export const metadata = { title: "Forum" };
export default async function ForumPage({
  params,
  searchParams,
}: {
  params: Promise<{ forumSlug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const notice = await communityNotice();
  if (notice) return notice;
  const { forumSlug } = await params;
  const { q, page: rawPage } = await searchParams;
  const forum = await findForum(forumSlug);
  if (!forum) notFound();
  const page = pageNumber(rawPage);
  const threads = await communityThreads({ forumId: forum.id, query: q, page });
  return (
    <div className="site-container space-y-6 py-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display-sm font-extrabold">{forum.title}</h1>
          <p className="mt-2 text-body-sm text-text-muted">{forum.description}</p>
        </div>
        <Link
          href={`/threads/new?forum=${forum.slug}`}
          className="button-primary"
        >
          New thread
        </Link>
      </header>
      <form className="surface flex gap-3 p-3" role="search">
        <input
          className="field"
          name="q"
          defaultValue={q}
          aria-label="Search this forum"
          maxLength={200}
        />
        <button className="button-secondary">Search</button>
      </form>
      <section className="space-y-2">
        {threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
        {!threads.length && (
          <p className="surface p-8 text-text-muted">No threads found.</p>
        )}
      </section>
      <nav className="flex gap-3" aria-label="Pagination">
        {page > 1 && (
          <Link
            className="button-secondary"
            href={`?page=${page - 1}&q=${encodeURIComponent(q ?? "")}`}
          >
            Previous
          </Link>
        )}
        {threads.length === 30 && (
          <Link
            className="button-secondary"
            href={`?page=${page + 1}&q=${encodeURIComponent(q ?? "")}`}
          >
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}
