import { notFound } from "next/navigation";
import { activeCategories, catalog } from "@/domains/commerce/commerce-service";
import { CatalogCards } from "@/components/catalog-cards";
import { pageNumber } from "@/db/queries/community";
import Link from "next/link";
export default async function CategoryPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const slug = (await params).slug;
  const selected = (await activeCategories()).find(item => item.slug === slug);
  if (!selected) notFound();
  const page = pageNumber((await searchParams).page);
  const rows = await catalog({ categoryId: selected.id, page });
  return <div className="site-container space-y-5 py-8"><Link href="/marketplace">Marketplace</Link><h1 className="text-display-sm font-bold">{selected.name}</h1><CatalogCards rows={rows} /><nav aria-label="Pagination" className="flex gap-4">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{rows.length === 24 && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></div>;
}
