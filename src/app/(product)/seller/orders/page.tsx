import { communityNotice } from "@/components/access-notice";
import Link from "next/link";
import { sellerOrders } from "@/domains/finance/seller-orders";
import { formatUsdt } from "@/domains/finance/money";
import { OrderFulfillment } from "@/components/order-fulfillment";

export default async function SellerOrdersPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const orders = await sellerOrders();
  return <div className="site-container max-w-4xl space-y-5 py-8">
    <h1 className="text-display-sm">Seller orders</h1>
    <p>Proceeds become available for internal purchases after the 24-hour hold. External cash-out is unavailable.</p>
    {!orders.length && <p className="surface p-6">No paid orders are available.</p>}
    {orders.map(order => <article className="surface space-y-4 p-6" key={order.id}>
      <h2 className="text-heading-lg">{order.title}</h2>
      <p>Order {order.id} · {order.status} · {formatUsdt(order.amountAtoms)} USDT proceeds</p>
      <p>{order.settled ? "Proceeds are available internally." : `Seller hold ends (UTC): ${order.holdUntil.toISOString()}`}</p>
      <p className="whitespace-pre-wrap">{order.terms}</p>
      {order.buyerUsername && <Link className="underline underline-offset-4" href={`/messages?to=${encodeURIComponent(order.buyerUsername)}`}>Message buyer</Link>}
      {order.fulfillmentMode === "manual" && order.status === "paid" && !order.fulfilledAt && <OrderFulfillment orderId={order.id} />}
      {order.fulfilledAt && <p>Fulfillment submitted at {order.fulfilledAt.toISOString()}.</p>}
    </article>)}
  </div>;
}
