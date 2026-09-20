import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { currentSellerProfile } from "@/domains/commerce/commerce-service";
import { createReadDatabase } from "@/db/client";
import { listings } from "@/db/schema";
import { formatUsd } from "@/domains/commerce/validation";
import { pageNumber } from "@/db/queries/community";
export default async function SellerListingsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const seller = await currentSellerProfile();
  if (!seller) return <div className="site-container max-w-4xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Your listings</h1><p>Open a storefront before creating listings.</p><Link className="button-primary" href="/seller/onboarding">Open your storefront</Link></div>;
  const page = pageNumber((await searchParams).page);
  const rows = await createReadDatabase().select().from(listings).where(eq(listings.sellerId, seller.userId)).orderBy(desc(listings.createdAt), desc(listings.id)).limit(30).offset((page - 1) * 30);
  return <div className="site-container max-w-4xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Your listings</h1>{seller.status === "active" ? <Link className="button-primary" href="/seller/listings/new">Create listing</Link> : <p className="surface p-5">Your storefront is {seller.status}. You can review existing records, but listing changes are unavailable until seller access is restored.</p>}{!rows.length && <p className="surface p-6">No listings on this page.</p>}{rows.map(listing => <article key={listing.id} className="surface space-y-3 p-5"><h2 className="text-heading-lg font-bold">{listing.title}</h2><p>{listing.status} · {formatUsd(listing.priceCents)} · Revision {listing.version}</p>{seller.status === "active" && listing.status !== "removed" && <Link className="text-category" href={`/seller/listings/${listing.id}/edit`}>Edit listing</Link>}</article>)}<nav aria-label="Pagination" className="flex gap-4">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{rows.length === 30 && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></div>;
}
