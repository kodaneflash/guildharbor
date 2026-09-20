import { desc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { listings } from "@/db/schema";
import { CommerceModerationForm } from "@/components/commerce-admin-forms";
import { pageNumber } from "@/db/queries/community";
import Link from "next/link";
export default async function ListingModerationPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) { await requirePermission("admin.manage"); const page = pageNumber((await searchParams).page); const rows = await createReadDatabase().select().from(listings).orderBy(desc(listings.createdAt), desc(listings.id)).limit(30).offset((page - 1) * 30); return <div className="site-container max-w-4xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Listing moderation</h1>{!rows.length && <p>No listings on this page.</p>}{rows.map(listing => <section className="surface space-y-3 p-5" key={listing.id}><h2 className="text-heading-lg font-bold">{listing.title}</h2><p>{listing.status} · Seller {listing.sellerId}</p><p className="whitespace-pre-wrap">{listing.description}</p><CommerceModerationForm id={listing.id} kind="listing" inactive={listing.status === "removed"} /></section>)}<nav aria-label="Pagination" className="flex gap-4">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{rows.length === 30 && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></div>; }
