import { ListingGallery } from "@/components/listing-gallery";
import { SellerPayload } from "@/components/seller-payload";
import { ResourceUpload } from "@/components/resource-upload";
import { ResourceFiles } from "@/components/resource-files";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ListingForm } from "@/components/commerce-forms";
import { activeCategories, currentSellerProfile } from "@/domains/commerce/commerce-service";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { listings } from "@/db/schema";
export default async function EditListingPage({ params }: { params: Promise<{ listingId: string }> }) {
  const access = await requireMember();
  const seller = await currentSellerProfile();
  if (!seller || seller.status !== "active") redirect("/seller");
  const id = (await params).listingId; if (!z.uuid().safeParse(id).success) notFound();
  const [listing] = await createReadDatabase().select().from(listings).where(and(eq(listings.id, id), eq(listings.sellerId, access.user.id)));
  if (!listing || listing.status === "removed") notFound();
  return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Edit listing</h1><section className="surface space-y-4 p-6"><h2 className="text-heading-lg font-bold">Listing images</h2><p>Up to 12 scanned images. These images are visible to signed-in members when the listing is published. Never upload delivery secrets here.</p><ListingGallery id={listing.id} title={listing.title} editable /><ResourceUpload purpose="listing_media" resourceId={listing.id} /></section><ListingForm key={`${listing.id}:${listing.version}`} listing={listing} categories={await activeCategories()} />{listing.fulfillmentMode === "text" && <SellerPayload id={listing.id} />}<section className="surface space-y-4 p-6"><h2 className="text-heading-lg font-bold">Seller-owned delivery files</h2><p>Uploading creates a new draft file-delivery revision. Buyers cannot access these files before verified payment exists.</p><ResourceFiles purpose="listing_delivery" resourceId={listing.id} /><ResourceUpload purpose="listing_delivery" resourceId={listing.id} /></section></div>;
}
