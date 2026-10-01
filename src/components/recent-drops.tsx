import { CalendarDays, Mail, ShoppingCart, Star } from "lucide-react";
import Link from "next/link";

import { CatalogImage } from "@/components/catalog-image";
import { SelectionButton } from "@/components/commerce-forms";
import { UserAvatar } from "@/components/user-avatar";
import type { catalog } from "@/domains/commerce/commerce-service";
import { formatUsd } from "@/domains/commerce/validation";

export function RecentDrops({ rows, viewerId }: { rows: Awaited<ReturnType<typeof catalog>>; viewerId: string }) {
  if (!rows.length) return <div className="surface p-6">
    <h3 className="text-heading-md">No listings yet</h3>
  </div>;

  return <ul aria-label="Recent marketplace listings" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {rows.map(({ listing, sellerName, username, sellerAvatar, imageId }) => <li key={listing.id} className="min-w-0">
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-3xl border border-border bg-panel">
        <div className="relative">
          <CatalogImage id={imageId} title={listing.title} cover />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-4 pt-12 text-white">
            <h3 className="break-words text-heading-lg"><Link className="hover:underline" href={`/marketplace/${listing.id}/${listing.slug}`}>{listing.title}</Link></h3>
            <Link href={`/sellers/${username}`} className="mt-2 flex min-w-0 items-center gap-2 text-body-sm text-white/90 hover:underline">
              <UserAvatar seed={sellerName} src={sellerAvatar ?? undefined} size="sm" />
              <span className="truncate">by {sellerName}</span>
            </Link>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <p className="line-clamp-2 text-body-sm text-text-secondary">{listing.description}</p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-body-xs text-text-muted">
            <span>{listing.available ? "Available" : "Currently unavailable"}</span>
            <time dateTime={listing.createdAt.toISOString()} className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5" />{listing.createdAt.toISOString().slice(0, 10)}</time>
          </div>
          <p className="text-heading-lg tabular-nums text-primary">{formatUsd(listing.priceCents)}</p>
          <div className="mt-auto flex flex-wrap items-start gap-2 border-t border-border pt-3">
            {listing.sellerId === viewerId ? <Link className="button-secondary" href={`/seller/listings/${listing.id}/edit`}>Edit your listing</Link> : <>
              {listing.available && <>
                <SelectionButton id={listing.id} operation="cart.add" buttonClassName="min-h-11 px-3"><ShoppingCart aria-hidden="true" className="size-4" /><span className="sr-only">Add {listing.title} to cart</span></SelectionButton>
                <SelectionButton id={listing.id} operation="favorite.add" buttonClassName="min-h-11 px-3"><Star aria-hidden="true" className="size-4" /><span className="sr-only">Save {listing.title} as a favorite</span></SelectionButton>
              </>}
              <Link className="button-secondary min-h-11 px-3" href={`/messages?to=${encodeURIComponent(username ?? "")}`} aria-label={`Contact seller ${sellerName} about ${listing.title}`}><Mail aria-hidden="true" className="size-4" /></Link>
            </>}
          </div>
        </div>
      </article>
    </li>)}
  </ul>;
}
