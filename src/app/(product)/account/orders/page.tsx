import { communityNotice } from "@/components/access-notice";
import Link from "next/link";
import { buyerOrders } from "@/domains/finance/orders";
import { financialServicingEnabled } from "@/domains/finance/gate";
import { formatUsdt } from "@/domains/finance/money";

export default async function OrdersPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const orders = await buyerOrders();
  return <div className="site-container space-y-5 py-8">
    <h1 className="text-display-sm">Your orders</h1>
    {!financialServicingEnabled ? <p className="surface p-6">Checkout currently provides review only; payments and funded fulfillment are unavailable.</p>
      : !orders.length ? <p className="surface p-6">You have no purchase orders.</p>
        : <ul className="space-y-3">{orders.map(order => <li key={order.id} className="surface space-y-2 p-6">
          <Link className="font-semibold underline" href={`/account/orders/${order.id}`}>{order.title}</Link>
          <p>{formatUsdt(order.amountAtoms)} USDT · {order.status}</p>
        </li>)}</ul>}
  </div>;
}
