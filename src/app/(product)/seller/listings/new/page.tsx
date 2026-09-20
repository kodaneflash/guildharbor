import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/commerce-forms";
import { activeCategories, currentSellerProfile } from "@/domains/commerce/commerce-service";

export default async function NewListingPage() {
  const seller = await currentSellerProfile();
  if (!seller) redirect("/seller/onboarding");
  if (seller.status !== "active") return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Seller access unavailable</h1><p>Your storefront is {seller.status}. Listing changes are unavailable until your seller access is restored.</p><Link className="button-secondary" href="/support">Contact support</Link></div>;
  return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Create listing</h1><ListingForm categories={await activeCategories()} /></div>;
}
