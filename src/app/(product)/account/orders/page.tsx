import { requireMember } from "@/lib/session";
export default async function OrdersPage() { await requireMember(); return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">Your orders</h1><p className="surface p-6">No purchase orders have been created. Checkout currently provides review only; payments and funded fulfillment are unavailable.</p></div>; }
