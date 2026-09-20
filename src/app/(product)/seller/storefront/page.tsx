import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { sellerProfiles } from "@/db/schema";
import { SellerForm } from "@/components/commerce-forms";
import Link from "next/link";
export default async function EditStorefrontPage() {
  const access = await requireMember(); const [seller] = await createReadDatabase().select().from(sellerProfiles).where(eq(sellerProfiles.userId, access.user.id));
  if (!seller) redirect("/seller/onboarding");
  return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Edit storefront</h1>{seller.status === "active" ? <SellerForm name={seller.name} description={seller.description} /> : <section className="surface space-y-4 p-6"><p>Your seller profile is {seller.status}. Storefront changes are unavailable until seller access is restored.</p><Link className="button-secondary" href="/support">Contact support</Link></section>}</div>;
}
