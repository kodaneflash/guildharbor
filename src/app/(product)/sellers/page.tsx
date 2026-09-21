import { and, asc, eq, ilike } from "drizzle-orm";
import Link from "next/link";
import { requireMember } from "@/lib/session";
import { communityMemberFilter } from "@/lib/community-access";
import { createReadDatabase } from "@/db/client";
import { sellerProfiles, users } from "@/db/schema";
import { pageNumber } from "@/db/queries/community";
export default async function SellersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireMember(); const search = await searchParams; const page = pageNumber(search.page);
  const rows = await createReadDatabase().select({ name: sellerProfiles.name, description: sellerProfiles.description, username: users.username }).from(sellerProfiles).innerJoin(users, eq(users.id, sellerProfiles.userId)).where(and(eq(sellerProfiles.status, "active"), communityMemberFilter(), search.q ? ilike(sellerProfiles.name, `%${search.q.slice(0, 200)}%`) : undefined)).orderBy(asc(sellerProfiles.name), asc(sellerProfiles.userId)).limit(30).offset((page - 1) * 30);
  return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">Sellers</h1><form className="flex flex-wrap gap-3"><input aria-label="Search storefronts" className="field grow" name="q" defaultValue={search.q} maxLength={200} /><button className="button-primary self-end">Search</button></form>{!rows.length && <p className="surface p-6">No active storefronts match this view.</p>}<div className="grid gap-4 sm:grid-cols-2">{rows.map(row => <article key={row.username} className="surface space-y-3 p-5"><h2 className="text-heading-lg font-bold"><Link href={`/sellers/${row.username}`}>{row.name}</Link></h2><p className="line-clamp-3">{row.description}</p></article>)}</div><nav aria-label="Pagination" className="flex gap-4">{page > 1 && <Link href={`?q=${encodeURIComponent(search.q ?? "")}&page=${page - 1}`}>Previous</Link>}{rows.length === 30 && <Link href={`?q=${encodeURIComponent(search.q ?? "")}&page=${page + 1}`}>Next</Link>}</nav></div>;
}
