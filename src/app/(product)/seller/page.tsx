import Link from "next/link";
import { requireMember } from "@/lib/session";
import { currentSellerProfile } from "@/domains/commerce/commerce-service";
export default async function SellerPage() {
  const access = await requireMember();
  const seller = await currentSellerProfile();
  return <div className="site-container max-w-4xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Seller workspace</h1>{seller ? <><p>{seller.name} — {seller.status}</p>{seller.status === "active" ? <nav aria-label="Seller workspace" className="flex flex-wrap gap-3"><Link className="button-primary" href="/seller/listings">Your listings</Link><Link className="button-secondary" href="/seller/storefront">Edit storefront</Link><Link className="button-secondary" href={`/sellers/${access.user.username}`}>View storefront</Link></nav> : <><p>Your storefront is unavailable to marketplace visitors. Existing listing and audit records remain preserved.</p><div className="flex flex-wrap gap-3"><Link className="button-secondary" href="/seller/listings">Review your listings</Link><Link className="button-secondary" href="/support">Contact support</Link></div></>}</> : <><p>Open a storefront to offer digital goods and services. Verified members can enroll without administrator approval.</p><Link className="button-primary" href="/seller/onboarding">Open your storefront</Link></>}<p className="text-text-muted">Payments, earnings and withdrawals are not available in this release.</p></div>;
}
