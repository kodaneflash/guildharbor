import Link from "next/link";
import type { catalog } from "@/domains/commerce/commerce-service";
import { formatUsd } from "@/domains/commerce/validation";
export function CatalogCards({ rows }: { rows: Pick<Awaited<ReturnType<typeof catalog>>[number], "listing" | "sellerName" | "username">[] }) {
  if (!rows.length) return <p className="surface p-6 text-text-muted">No published listings match this view.</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{rows.map(({ listing, sellerName, username }) => <article key={listing.id} className="surface space-y-3 p-5"><p className="text-body-xs uppercase text-text-muted">{listing.kind === "service" ? "Service" : "Digital goods"}</p><h2 className="text-heading-lg font-bold"><Link href={`/marketplace/${listing.id}/${listing.slug}`}>{listing.title}</Link></h2><p className="line-clamp-3 whitespace-pre-wrap text-body-sm">{listing.description}</p><p>{formatUsd(listing.priceCents)}</p><p className="text-body-sm">{listing.available ? "Available" : "Currently unavailable"} · {listing.fulfillmentMode} delivery</p><Link className="text-category" href={`/sellers/${username}`}>{sellerName}</Link></article>)}</div>;
}
