import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { createReadDatabase } from "@/db/client";
import { listingFavorites } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { listingDetail } from "@/domains/commerce/commerce-service";
import { CatalogCards } from "@/components/catalog-cards";
import { SelectionButton } from "@/components/commerce-forms";
import { pageNumber } from "@/db/queries/community";
export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const access = await requireMember(); const page = pageNumber((await searchParams).page);
  const favorites = await createReadDatabase().select().from(listingFavorites).where(eq(listingFavorites.userId, access.user.id)).orderBy(desc(listingFavorites.createdAt), desc(listingFavorites.listingId)).limit(24).offset((page - 1) * 24);
  const rows = await Promise.all(favorites.map(async favorite => ({ favorite, row: await listingDetail(favorite.listingId) })));
  return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">Your favorites</h1>{!rows.length && <p className="surface p-6">No favorites on this page.</p>}{rows.map(({ favorite, row }) => <section className="space-y-3" key={favorite.listingId}>{row ? <CatalogCards rows={[row]} /> : <p>Saved listing is no longer available.</p>}<SelectionButton id={favorite.listingId} operation="favorite.remove">Remove {row?.listing.title ?? "unavailable listing"} from favorites</SelectionButton></section>)}<nav aria-label="Favorites pagination" className="flex gap-4">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{rows.length === 24 && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></div>;
}
