import Link from "next/link";
import { Suspense } from "react";

import { communityNotice } from "@/components/access-notice";
import { HomeAnnouncements } from "@/components/home-announcements";
import { RecentDrops } from "@/components/recent-drops";
import { catalog, sellerWorkspaceHref } from "@/domains/commerce/commerce-service";
import { requireMember } from "@/lib/session";

async function HomeDiscovery() {
  const [access, rows, sellerHref] = await Promise.all([
    requireMember(), catalog({ sort: "newest" }), sellerWorkspaceHref(),
  ]);
  return <div className="space-y-8">
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <section className="surface space-y-4 p-5" aria-label="Marketplace discovery">
        <form action="/marketplace" role="search" className="flex flex-wrap gap-3">
          <label htmlFor="home-search" className="sr-only">Find a listing</label>
          <input id="home-search" className="field min-w-0 flex-1 basis-48" type="search" name="q" placeholder="What do you need today?" maxLength={200} />
          <button className="button-primary">Search</button>
        </form>
        <nav aria-label="Product kinds" className="flex flex-wrap gap-3">
          <Link className="button-secondary" href="/marketplace?kind=digital">Digital goods</Link>
          <Link className="button-secondary" href="/marketplace?kind=service">Services</Link>
        </nav>
      </section>
      <aside className="surface flex flex-col justify-between gap-4 p-5" aria-label="Seller discovery">
        <h2 className="text-heading-md">Start selling on Outlaw</h2>
        <Link className="button-secondary min-h-12 w-full rounded-xl" href={sellerHref}>Open a store</Link>
      </aside>
    </div>
    <section aria-labelledby="recent-drops-heading" className="space-y-4">
      <h2 id="recent-drops-heading" className="text-heading-xl">Recent Drops</h2>
      <RecentDrops rows={rows} viewerId={access.user.id} />
    </section>
  </div>;
}

export default async function HomePage() {
  const notice = await communityNotice();
  if (notice) return notice;
  return <div className="site-container space-y-6 py-6 sm:py-8">
    <header><h1 className="text-display-sm">Home</h1></header>
    <Suspense fallback={<div role="status" className="surface p-6 text-text-muted">Loading announcements…</div>}><HomeAnnouncements /></Suspense>
    <Suspense fallback={<div role="status" className="surface p-6 text-text-muted">Loading recent drops…</div>}><HomeDiscovery /></Suspense>
  </div>;
}
