import Link from "next/link";
import { Store } from "lucide-react";
import { Suspense } from "react";
import { communityNotice } from "@/components/access-notice";
import { CatalogRows } from "@/components/catalog-rows";
import { TopSubforums } from "@/components/top-subforums";
import { topSubforums } from "@/db/queries/community";
import { catalog, sellerWorkspaceHref } from "@/domains/commerce/commerce-service";
import { requireMember } from "@/lib/session";

async function HomeDiscovery() {
  const [access, rows, forums, sellerHref] = await Promise.all([
    requireMember(), catalog(), topSubforums(), sellerWorkspaceHref(),
  ]);
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
        <aside className="surface min-w-0 space-y-5 p-5" aria-label="Marketplace discovery">
          <form action="/marketplace" role="search" className="space-y-3"><label htmlFor="home-search" className="block font-bold">Find a listing</label><input id="home-search" className="field w-full min-w-0" type="search" name="q" placeholder="Search listings" maxLength={200} /><button className="button-primary w-full">Search</button></form>
          <nav aria-label="Product kinds" className="space-y-3 text-body-sm text-category"><Link className="block" href="/marketplace?kind=digital">Digital goods</Link><Link className="block" href="/marketplace?kind=service">Services</Link></nav>
        </aside>
        <section className="min-w-0 space-y-4" aria-labelledby="latest-listings-heading"><div className="flex flex-wrap items-center justify-between gap-2"><h1 id="latest-listings-heading" className="text-heading-md font-bold">Latest listings</h1><Link className="text-body-sm text-category" href="/marketplace">View all</Link></div><CatalogRows rows={rows} viewerId={access.user.id} /></section>
        <aside className="min-w-0 space-y-5" aria-label="Seller and forum discovery">
          <section className="space-y-5 rounded-[2rem] border border-border-strong bg-page-deep p-5" aria-labelledby="start-selling-heading">
            <div className="flex items-start gap-4">
              <Store aria-hidden="true" className="mt-1 size-8 shrink-0 text-text-muted" strokeWidth={2.25} />
              <div className="min-w-0 space-y-1">
                <h2 id="start-selling-heading" className="text-heading-md font-bold">Start selling on GuildHarbor</h2>
                <p className="text-body-sm leading-6 text-text-muted">Create a storefront, publish your listings, and connect with members.</p>
              </div>
            </div>
            <Link className="button-secondary min-h-12 w-full rounded-xl" href={sellerHref}>Open a store</Link>
          </section>
          <TopSubforums forums={forums} />
        </aside>
      </div>
  );
}

export default async function HomePage() {
  const notice = await communityNotice();
  if (notice) return notice;
  return <div className="discovery-container py-7 sm:py-10">
    <Suspense fallback={<div role="status" className="surface p-6 text-text-muted">Loading listings and community discovery…</div>}><HomeDiscovery /></Suspense>
  </div>;
}
