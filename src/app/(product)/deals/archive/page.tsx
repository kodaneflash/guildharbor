import { DealList } from "@/components/deal-list";
import { pageNumber } from "@/db/queries/community";
export default async function DealsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) { return <DealList archive page={pageNumber((await searchParams).page)} />; }
