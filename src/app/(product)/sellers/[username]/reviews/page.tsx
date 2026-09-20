import { SellerProfile } from "@/components/seller-profile";
export default async function ReviewsPage({ params }: { params: Promise<{ username: string }> }) { return <SellerProfile username={(await params).username} reviews />; }
