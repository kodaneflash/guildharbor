import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createReadDatabase } from "@/db/client";
import { sellerProfiles, users } from "@/db/schema";
import { communityMemberFilter } from "@/lib/community-access";
import { requireMember } from "@/lib/session";
import { resolvePublicProfile } from "@/db/resolve-profile";
import { catalog } from "@/domains/commerce/commerce-service";
import { CatalogCards } from "./catalog-cards";
export async function SellerProfile({ username, reviews = false, page = 1 }: { username: string; reviews?: boolean; page?: number }) {
  const access = await requireMember();
  const [seller] = await createReadDatabase().select({ id: sellerProfiles.userId, name: sellerProfiles.name, description: sellerProfiles.description }).from(sellerProfiles).innerJoin(users, eq(users.id, sellerProfiles.userId)).where(and(eq(users.username, username), eq(sellerProfiles.status, "active"), communityMemberFilter()));
  if (!seller) notFound(); const profile = await resolvePublicProfile(username); if (!profile) notFound();
  const listings = reviews ? [] : await catalog({ sellerId: seller.id, page });
  return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">{seller.name}</h1><nav aria-label="Seller sections" className="flex gap-4"><Link aria-current={!reviews ? "page" : undefined} href={`/sellers/${username}`}>Information</Link><Link aria-current={reviews ? "page" : undefined} href={`/sellers/${username}/reviews`}>Reviews</Link></nav>{reviews ? <section className="surface space-y-3 p-6"><h2 className="text-heading-lg font-bold">Verified purchase reviews</h2><p>No verified purchase reviews yet.</p><p className="text-text-muted">Reviews require verified payment and completed fulfillment. Unfunded deals, community reputation and vouches do not qualify.</p></section> : <><section className="surface space-y-3 p-6"><p className="whitespace-pre-wrap">{seller.description}</p><p>Member since {profile.joined}</p><Link className="text-category" href={`/members/${username}`}>Community profile</Link><p>Visible community activity: {profile.threads} threads · {profile.posts} posts</p>{profile.telegram && <p>Telegram: {profile.telegram}</p>}{profile.discord && <p>Discord: {profile.discord}</p>}<p>Verified marketplace statistics are unavailable until paid transactions are enabled.</p>{seller.id === access.user.id ? <Link className="button-secondary" href="/seller">Manage your storefront</Link> : <Link className="button-secondary" href={`/messages?to=${encodeURIComponent(username)}`}>Contact seller</Link>}</section><h2 className="text-heading-lg font-bold">Active listings</h2><CatalogCards rows={listings} /><nav aria-label="Seller listing pagination" className="flex gap-3">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{listings.length === 24 && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></>}</div>;
}
