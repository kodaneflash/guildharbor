import { ArrowRight, Brush, Pin, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CategorySection } from "@/components/category-section";
import { ThreadRow } from "@/components/thread-row";
import { demoCategories, demoThreads } from "@/data/demo";

export default function HomePage() {
  return (
    <div className="site-container space-y-8 py-7 sm:py-10">
      <section className="grid gap-2" aria-label="Community notices">
        <Link href="/marketplace" className="flex min-h-[66px] items-center gap-4 rounded-md border border-border bg-panel px-4 transition-colors hover:border-border-strong hover:bg-panel-raised">
          <Pin className="size-6 shrink-0 fill-trust text-trust" aria-hidden="true" />
          <span className="min-w-0">
            <strong className="block text-sm text-trust">Sell with clarity and confidence</strong>
            <span className="mt-1 block text-xs text-text-muted">Verified listing fields and public feedback help members make informed decisions.</span>
          </span>
          <ArrowRight className="ml-auto hidden size-4 text-text-muted sm:block" />
        </Link>
        <Link href="/threads/new" className="flex min-h-[66px] items-center gap-4 rounded-md border border-border bg-panel px-4 transition-colors hover:border-border-strong hover:bg-panel-raised">
          <Brush className="size-6 shrink-0 text-pink" aria-hidden="true" />
          <span className="min-w-0">
            <strong className="block text-sm text-pink">Make your post easy to scan</strong>
            <span className="mt-1 block text-xs text-text-muted">Use accurate titles, structured details, and accessible images.</span>
          </span>
          <ArrowRight className="ml-auto hidden size-4 text-text-muted sm:block" />
        </Link>
      </section>

      <section aria-labelledby="latest-heading" className="space-y-2">
        <div className="section-heading">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-sticky" />
            <div>
              <h1 id="latest-heading" className="text-sm font-extrabold uppercase tracking-[0.08em] text-text">Latest discussions</h1>
              <p className="mt-1 text-xs text-text-muted">Fresh activity from across GuildHarbor.</p>
            </div>
          </div>
          <Link href="/forums" className="button-secondary hidden sm:inline-flex">Browse all</Link>
        </div>
        <div className="space-y-2">
          {demoThreads.slice(0, 6).map((thread) => <ThreadRow key={thread.id} thread={thread} />)}
        </div>
      </section>

      {demoCategories.map((category) => <CategorySection key={category.slug} category={category} />)}
    </div>
  );
}
