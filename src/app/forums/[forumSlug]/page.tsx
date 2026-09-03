import { Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ThreadRow } from "@/components/thread-row";
import { demoThreads, findForum } from "@/data/demo";

type ForumPageProps = { params: Promise<{ forumSlug: string }> };

export async function generateMetadata({ params }: ForumPageProps): Promise<Metadata> {
  const { forumSlug } = await params;
  return { title: findForum(forumSlug)?.name ?? "Forum" };
}

export default async function ForumPage({ params }: ForumPageProps) {
  const { forumSlug } = await params;
  const forum = findForum(forumSlug);
  if (!forum) notFound();

  const threads = demoThreads.filter((thread) => thread.forumSlug === forumSlug);
  const visibleThreads = threads.length > 0 ? threads : demoThreads;

  return (
    <div className="site-container space-y-6 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "GuildHarbor", href: "/" }, { label: "Forums", href: "/forums" }, { label: forum.name }]} />
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text sm:text-3xl">{forum.name}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">{forum.description}</p>
          <p className="mt-2 text-xs text-text-muted">{forum.threadCount.toLocaleString()} threads · {forum.postCount.toLocaleString()} posts</p>
        </div>
        <Link href={`/threads/new?forum=${forum.slug}`} className="button-primary self-start sm:self-auto"><Plus className="size-4" /> New thread</Link>
      </header>

      <form action={`/forums/${forum.slug}`} className="grid gap-2 rounded-md border border-border bg-panel p-3 sm:grid-cols-[1fr_auto_auto]" role="search">
        <label className="relative">
          <span className="sr-only">Search this forum</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <input name="q" className="field pl-10" placeholder={`Search ${forum.name}`} />
        </label>
        <button className="button-secondary" type="submit"><Filter className="size-4" /> Filter</button>
        <button className="button-secondary" type="button"><SlidersHorizontal className="size-4" /> Latest</button>
      </form>

      <section aria-labelledby="sticky-threads" className="space-y-2">
        <div className="section-heading">
          <h2 id="sticky-threads" className="text-sm font-extrabold uppercase tracking-[0.08em] text-text">Threads</h2>
          <span className="text-xs text-text-muted">Pinned first · latest activity</span>
        </div>
        {visibleThreads.map((thread) => <ThreadRow key={thread.id} thread={thread} />)}
      </section>
    </div>
  );
}
