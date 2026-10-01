import { Info, Mail, ShoppingCart, Star } from "lucide-react";
import Link from "next/link";

import { CatalogImage } from "@/components/catalog-image";
import { SelectionButton } from "@/components/commerce-forms";
import { UserAvatar } from "@/components/user-avatar";
import type { catalog } from "@/domains/commerce/commerce-service";
import { formatUsd } from "@/domains/commerce/validation";

export function CatalogRows({ rows, viewerId }: { rows: Awaited<ReturnType<typeof catalog>>; viewerId: string }) {
  if (!rows.length) {
    return (
      <div className="surface space-y-2 p-6">
        <h2 className="font-semibold">No listings yet</h2>
        <p className="text-body-sm text-text-muted">
          Published listings will appear here when members offer digital goods or services.
        </p>
        <Link className="text-category" href="/marketplace">Browse the marketplace</Link>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label="Marketplace listings">
      {rows.map(({ listing, sellerName, username, sellerAvatar, imageId }) => {
        const listingHref = `/marketplace/${listing.id}/${listing.slug}`;

        return (
          <li key={listing.id}>
            <article className="group grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 rounded-2xl border border-border bg-panel p-3 transition-colors hover:border-border-strong hover:bg-panel-raised sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] lg:min-h-[82px] lg:gap-x-4 lg:px-4">
              <CatalogImage id={imageId} title={listing.title} compact />

              <div className="min-w-0 self-center">
                <div className="mb-0.5 flex min-w-0 items-center gap-2">
                  {!listing.available && (
                    <span className="shrink-0 rounded border border-danger/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none text-danger">
                      Unavailable
                    </span>
                  )}
                  <h2 className="min-w-0 truncate text-heading-sm text-text lg:text-heading-md">
                    <Link className="transition hover:text-primary" href={listingHref}>{listing.title}</Link>
                  </h2>
                </div>
                <p className="truncate text-body-sm leading-5 text-text-muted">{listing.description}</p>
                <Link className="mt-1 inline-block max-w-full truncate text-body-xs text-text-secondary hover:text-text sm:hidden" href={`/sellers/${username}`}>
                  {sellerName}
                </Link>
              </div>

              <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 border-t border-border pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
                <div className="flex shrink-0 items-start gap-1">
                  <Link
                    className="inline-flex size-10 items-center justify-center rounded-full text-text-muted transition hover:bg-panel-raised hover:text-text"
                    href={listingHref}
                    aria-label={`View details for ${listing.title}`}
                  >
                    <Info aria-hidden="true" className="size-[18px]" />
                  </Link>

                  {listing.sellerId === viewerId ? (
                    <Link className="button-secondary min-h-10 rounded-full px-3" href={`/seller/listings/${listing.id}/edit`}>
                      Edit
                    </Link>
                  ) : (
                    <>
                      {listing.available && (
                        <>
                          <SelectionButton id={listing.id} operation="cart.add" buttonClassName="size-10 min-h-10 rounded-full p-0">
                            <ShoppingCart aria-hidden="true" className="size-[18px]" />
                            <span className="sr-only">Add {listing.title} to cart</span>
                          </SelectionButton>
                          <SelectionButton id={listing.id} operation="favorite.add" buttonClassName="size-10 min-h-10 rounded-full p-0">
                            <Star aria-hidden="true" className="size-[18px]" />
                            <span className="sr-only">Save {listing.title} as a favorite</span>
                          </SelectionButton>
                        </>
                      )}
                      <Link
                        className="inline-flex size-10 items-center justify-center rounded-full text-text-muted transition hover:bg-panel-raised hover:text-text"
                        href={`/messages?to=${encodeURIComponent(username ?? "")}`}
                        aria-label={`Contact seller ${sellerName} about ${listing.title}`}
                      >
                        <Mail aria-hidden="true" className="size-[18px]" />
                      </Link>
                    </>
                  )}
                </div>

                <p className="min-w-[5.5rem] text-right text-lg font-semibold tabular-nums text-text lg:text-xl">
                  {formatUsd(listing.priceCents)}
                </p>

                <Link
                  className="hidden w-14 shrink-0 flex-col items-center gap-1 text-center text-[10px] leading-3 text-text-muted transition hover:text-text sm:flex"
                  href={`/sellers/${username}`}
                  aria-label={`View seller ${sellerName}`}
                >
                  <UserAvatar seed={sellerName} src={sellerAvatar ?? undefined} size="sm" />
                  <span className="w-full truncate">{sellerName}</span>
                </Link>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
