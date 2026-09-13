import Link from "next/link";
import { communityNotice } from "@/components/access-notice";
import { ThreadRow } from "@/components/thread-row";
import { communityThreads, pageNumber } from "@/db/queries/community";
import { requireMember } from "@/lib/session";
import { enforceRateLimit } from "@/lib/rate-limit";
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await requireMember();
  await enforceRateLimit("search", access.user.id);
  const { q = "", page: rawPage } = await searchParams;
  const page = pageNumber(rawPage);
  const matches = await communityThreads({ query: q, page });
  return (
    <div className="site-container space-y-6 py-8">
      <h1 className="text-3xl font-extrabold">Search GuildHarbor</h1>
      <p className="text-text-muted">Search thread titles and posts.</p>
      <form className="surface flex gap-3 p-4" role="search">
        <input
          className="field"
          aria-label="Search threads and posts"
          name="q"
          defaultValue={q}
          maxLength={200}
        />
        <button className="button-primary">Search</button>
      </form>
      <section className="space-y-2">
        {matches.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
        {!matches.length && (
          <p className="surface p-8 text-text-muted">No results found.</p>
        )}
      </section>
      <nav className="flex gap-3" aria-label="Pagination">
        {page > 1 && (
          <Link href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>
            Previous
          </Link>
        )}
        {matches.length === 30 && (
          <Link href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}
