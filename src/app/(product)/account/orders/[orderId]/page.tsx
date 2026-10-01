import { communityNotice } from "@/components/access-notice";
import { notFound } from "next/navigation";
import { buyerOrder } from "@/domains/finance/orders";
import { formatUsdt } from "@/domains/finance/money";

export default async function OrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const notice = await communityNotice();
  if (notice) return notice;
  const row = await buyerOrder((await params).orderId);
  if (!row) notFound();
  const entitled = row.deliveryAllowed && ["paid", "completed"].includes(row.order.status) && !row.order.refundJournalId;
  return <div className="site-container max-w-3xl space-y-5 py-8">
    <h1 className="text-display-sm">{row.revision.title}</h1>
    <section className="surface space-y-3 p-6">
      <p>Status: {row.order.status}</p>
      <p>Paid: {formatUsdt(row.amountAtoms)} USDT</p>
      <p className="whitespace-pre-wrap">{row.revision.deliveryTerms}</p>
      {!entitled && <p>Delivery access is suspended for this order.</p>}
      {entitled && row.revision.fulfillmentMode === "file" && row.revision.protectedFileId &&
        <a className="button-primary" href={`/api/files/${row.revision.protectedFileId}`}>Download purchased file</a>}
      {entitled && row.revision.fulfillmentMode === "text" &&
        <a className="button-primary" href={`/api/orders/${row.order.id}/delivery`}>Open protected delivery</a>}
      {entitled && row.revision.fulfillmentMode === "manual" && <>
        <p>{row.fulfillment ? "The seller submitted fulfillment." : "Awaiting seller fulfillment according to the purchased terms above."}</p>
        {row.fulfillment && <a className="button-primary" href={`/api/orders/${row.order.id}/delivery`}>Open seller fulfillment</a>}
        {row.sellerUsername && <a className="button-secondary" href={`/messages?to=${encodeURIComponent(row.sellerUsername)}`}>Contact seller</a>}
      </>}
    </section>
  </div>;
}
