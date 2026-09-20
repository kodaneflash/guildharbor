import Link from "next/link";
import { Suspense } from "react";
import { communityNotice } from "@/components/access-notice";
import { CatalogRows } from "@/components/catalog-rows";
import { TopSubforums } from "@/components/top-subforums";
import { topSubforums } from "@/db/queries/community";
import { activeCategories, catalog, sellerWorkspaceHref } from "@/domains/commerce/commerce-service";
import { requireMember } from "@/lib/session";

async function HomeDiscovery() {
  const [access, categories, rows, forums, sellerHref] = await Promise.all([
    requireMember(), activeCategories(), catalog(), topSubforums(), sellerWorkspaceHref(),
  ]);
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
        <aside className="surface min-w-0 space-y-5 p-5" aria-label="Marketplace discovery">
          <form action="/marketplace" role="search" className="space-y-3"><label htmlFor="home-search" className="block font-bold">Find a listing</label><input id="home-search" className="field w-full min-w-0" type="search" name="q" placeholder="Search listings" maxLength={200} /><button className="button-primary w-full">Search</button></form>
          <nav aria-label="Marketplace categories" className="space-y-3"><h2 className="font-bold">Categories</h2><Link className="block text-body-sm text-category" href="/marketplace">All listings and filters</Link>{categories.length ? <ul className="space-y-3">{categories.map(category => <li key={category.id}><Link className="break-words text-body-sm text-category" href={`/marketplace/categories/${category.slug}`}>{category.name}</Link></li>)}</ul> : <p className="text-body-sm text-text-muted">Categories are not configured yet. Browse all listings or search above.</p>}</nav>
          <nav aria-label="Product kinds" className="space-y-3 text-body-sm text-category"><Link className="block" href="/marketplace?kind=digital">Digital goods</Link><Link className="block" href="/marketplace?kind=service">Services</Link></nav>
        </aside>
        <section className="min-w-0 space-y-4" aria-labelledby="latest-listings-heading"><div className="flex flex-wrap items-center justify-between gap-2"><h2 id="latest-listings-heading" className="text-heading-md font-bold">Latest listings</h2><Link className="text-body-sm text-category" href="/marketplace">View all</Link></div><CatalogRows rows={rows} viewerId={access.user.id} /></section>
        <aside className="min-w-0 space-y-5" aria-label="Seller and forum discovery">
          <section className="surface space-y-4 p-5" aria-labelledby="start-selling-heading"><h2 id="start-selling-heading" className="text-heading-md font-bold">Start selling on GuildHarbor</h2><p className="text-body-sm text-text-muted">Create a storefront, publish your listings, and connect with members.</p><Link className="button-primary" href={sellerHref}>Open a store</Link><p className="text-body-xs text-text-muted">Payments, earnings, and withdrawals are not available yet.</p><Link className="block text-body-sm text-category" href="/sellers">Meet the sellers →</Link></section>
          <TopSubforums forums={forums} />
        </aside>
      </div>
  );
}

export default async function HomePage() {
  const notice = await communityNotice();
  if (notice) return notice;
  return <div className="discovery-container space-y-6 py-7 sm:py-10">
    <header className="space-y-2"><h1 className="text-display-sm font-bold">Discover GuildHarbor</h1><p className="max-w-3xl text-body-sm text-text-muted">Digital goods, services, and conversations from your community. Carts are for review only; payments and funded delivery are not available yet.</p></header>
    <Suspense fallback={<div role="status" className="surface p-6 text-text-muted">Loading listings and community discovery…</div>}><HomeDiscovery /></Suspense>
  </div>;
}
