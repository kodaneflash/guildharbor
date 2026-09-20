import { requireMember } from "@/lib/session";
export default async function SellerOrdersPage() { await requireMember(); return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">Seller orders</h1><p className="surface p-6">No paid orders are available. Payments and funded delivery remain disabled.</p></div>; }
