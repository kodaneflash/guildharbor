import { pageNumber } from "@/db/queries/community";
import { SellerProfile } from "@/components/seller-profile";
export default async function SellerPage({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ page?: string }> }) { return <SellerProfile username={(await params).username} page={pageNumber((await searchParams).page)} />; }
