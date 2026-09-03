import { BadgeCheck, Search, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { ThreadRow } from "@/components/thread-row";
import { demoThreads } from "@/data/demo";

export const metadata: Metadata = { title: "Marketplace" };
export default function MarketplacePage() {
  const marketplaceThreads = demoThreads.filter((thread) => ["selling", "buying", "service"].includes(thread.type));
  return <div className="site-container space-y-6 py-8 sm:py-10"><Breadcrumbs items={[{ label: "GuildHarbor", href: "/" }, { label: "Marketplace" }]} /><header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[.12em] text-trust"><ShieldCheck className="size-4" /> Curated lawful marketplace</div><h1 className="mt-3 text-3xl font-black text-text">Find original work and trusted services.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted">Listings are community posts, not guarantees. Verify scope, ownership, and terms before transacting.</p></div><Link href="/threads/new?forum=digital-goods" className="button-primary self-start">Create listing</Link></header><section className="grid gap-3 sm:grid-cols-3"><MarketplaceFeature title="Licensed goods" detail="Original or properly licensed digital products only." /><MarketplaceFeature title="Clear terms" detail="Listings describe scope, fulfillment, and ownership." /><MarketplaceFeature title="Public feedback" detail="Vouches and reputation remain visible and disputable." /></section><form role="search" className="flex gap-2 rounded-md border border-border bg-panel p-3"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" /><input className="field pl-10" name="q" placeholder="Search listings and services" /></label><button className="button-secondary">Search</button></form><section className="space-y-2"><div className="section-heading"><h2 className="text-sm font-extrabold uppercase tracking-[.08em]">Latest listings</h2><span className="text-xs text-text-muted">Pinned first · newest activity</span></div>{marketplaceThreads.map((thread) => <ThreadRow key={thread.id} thread={thread} />)}</section></div>;
}
function MarketplaceFeature({ title, detail }: { title: string; detail: string }) { return <div className="surface p-4"><BadgeCheck className="size-5 text-cyan" /><strong className="mt-3 block text-sm text-text">{title}</strong><p className="mt-1 text-xs leading-5 text-text-muted">{detail}</p></div>; }
