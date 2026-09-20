import { ListingGallery } from "@/components/listing-gallery";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listingDetail } from "@/domains/commerce/commerce-service";
import { formatUsd } from "@/domains/commerce/validation";
import { SelectionButton } from "@/components/commerce-forms";
import { requireMember } from "@/lib/session";
export const metadata = { title: "Listing" };
export default async function ListingPage({ params }: { params: Promise<{ listingId: string; slug: string }> }) {
  const { listingId, slug } = await params; const row = await listingDetail(listingId); if (!row) notFound();
  const { listing, sellerName, username } = row;
  if (slug !== listing.slug) redirect(`/marketplace/${listing.id}/${listing.slug}`);
  const access = await requireMember();
  return <div className="site-container max-w-4xl space-y-6 py-8"><Link href="/marketplace">Marketplace</Link><h1 className="text-display-sm font-bold">{listing.title}</h1><Link className="text-category" href={`/sellers/${username}`}>{sellerName}</Link><p className="text-heading-xl font-bold">{formatUsd(listing.priceCents)}</p><p>{listing.kind === "service" ? "Service" : "Digital goods"} · {listing.available ? "Available" : "Unavailable"}</p><ListingGallery id={listing.id} title={listing.title} /><section className="surface space-y-4 p-6"><h2 className="text-heading-lg font-bold">Description</h2><p className="whitespace-pre-wrap">{listing.description}</p><h2 className="text-heading-lg font-bold">{listing.fulfillmentMode} delivery</h2><p className="whitespace-pre-wrap">{listing.deliveryTerms}</p></section><p className="text-text-muted">Payments and funded delivery are unavailable. No protected payload is released during review.</p>{access.user.id === listing.sellerId ? <Link className="button-secondary" href={`/seller/listings/${listing.id}/edit`}>Edit your listing</Link> : <div className="flex flex-wrap gap-3"><Link className="button-secondary" href={`/messages?to=${encodeURIComponent(username ?? "")}`}>Contact seller</Link>{listing.available && <><SelectionButton id={listing.id} operation="cart.add">Add to cart</SelectionButton><SelectionButton id={listing.id} operation="favorite.add">Save favorite</SelectionButton><Link className="button-primary" href={`/checkout?listing=${listing.id}`}>Review purchase</Link></>}</div>}</div>;
}
