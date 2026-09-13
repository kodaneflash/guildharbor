import Link from "next/link";
import { CategorySection } from "@/components/category-section";
import { ThreadRow } from "@/components/thread-row";
import { communityNotice } from "@/components/access-notice";
import { forumCategories, communityThreads } from "@/db/queries/community";
export default async function HomePage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const [categories, threads] = await Promise.all([
    forumCategories(),
    communityThreads(),
  ]);
  return (
    <div className="site-container space-y-8 py-7 sm:py-10">
      <section className="space-y-2">
        <div className="section-heading">
          <div>
            <h1 className="text-sm font-extrabold uppercase tracking-[0.08em]">
              Latest discussions
            </h1>
            <p className="mt-1 text-xs text-text-muted">
              Fresh activity from across GuildHarbor.
            </p>
          </div>
          <Link href="/threads/new" className="button-primary">
            New thread
          </Link>
        </div>
        {threads.length ? (
          threads
            .slice(0, 6)
            .map((thread) => <ThreadRow key={thread.id} thread={thread} />)
        ) : (
          <p className="surface p-8 text-text-muted">No discussions yet.</p>
        )}
      </section>
      {categories.map((category) => (
        <CategorySection key={category.slug} category={category} />
      ))}
      {!categories.length && (
        <p className="surface p-8 text-text-muted">No forums available yet.</p>
      )}
    </div>
  );
}
