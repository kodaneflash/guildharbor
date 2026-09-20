import Link from "next/link";
import { Mail } from "lucide-react";
import type { catalog } from "@/domains/commerce/commerce-service";
import { formatUsd } from "@/domains/commerce/validation";
import { CatalogImage } from "@/components/catalog-image";
import { SelectionButton } from "@/components/commerce-forms";
import { UserAvatar } from "@/components/user-avatar";

export function CatalogRows({ rows, viewerId }: { rows: Awaited<ReturnType<typeof catalog>>; viewerId: string }) {
  if (!rows.length) return <div className="surface space-y-2 p-6"><h3 className="font-bold">No listings yet</h3><p className="text-body-sm text-text-muted">Published listings will appear here when members offer digital goods or services.</p><Link className="text-category" href="/sellers">Discover sellers</Link></div>;
  return <ul className="space-y-4" aria-label="Latest listings">{rows.map(({ listing, sellerName, username, sellerAvatar, imageId }) => (
    <li key={listing.id}>
      <article className="surface flex min-w-0 flex-wrap gap-4 p-4 sm:flex-nowrap sm:p-5">
        <CatalogImage id={imageId} title={listing.title} />
        <div className="min-w-0 flex-1 basis-40 space-y-3 break-words">
          <p className="text-body-xs uppercase tracking-wide text-text-muted">{listing.kind === "service" ? "Service" : "Digital goods"}</p>
          <h3 className="text-heading-md font-bold"><Link href={`/marketplace/${listing.id}/${listing.slug}`}>{listing.title}</Link></h3>
          <p className="line-clamp-2 text-body-sm text-text-muted">{listing.description}</p>
          <Link className="inline-flex max-w-full items-center gap-2 text-body-sm text-category" href={`/sellers/${username}`}><UserAvatar seed={sellerName} src={sellerAvatar ?? undefined} size="sm" /><span className="min-w-0 break-words">{sellerName}</span></Link>
          <p className="font-bold">{formatUsd(listing.priceCents)}</p>
          {listing.sellerId === viewerId ? (
            <Link className="button-secondary" href={`/seller/listings/${listing.id}/edit`}>Edit your listing</Link>
          ) : (
            <div className="flex flex-wrap items-start gap-2">
              {listing.available ? (
                <SelectionButton id={listing.id} operation="cart.add">Add to cart<span className="sr-only">: {listing.title}</span></SelectionButton>
              ) : (
                <p className="basis-full text-body-sm text-text-muted">Currently unavailable</p>
              )}
              <Link
                className="button-secondary min-h-11 min-w-11"
                href={`/messages?to=${encodeURIComponent(username ?? "")}`}
                aria-label={`Contact seller ${sellerName} about ${listing.title}`}
              >
                <Mail aria-hidden="true" className="size-4" />
              </Link>
            </div>
          )}
        </div>
      </article>
    </li>
  ))}</ul>;
}
