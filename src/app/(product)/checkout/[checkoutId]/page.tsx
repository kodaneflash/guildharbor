import { communityNotice } from "@/components/access-notice";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { financialServicingEnabled, newPurchasesEnabled } from "@/domains/finance/gate";
import { checkoutView } from "@/domains/finance/checkout";
import { formatUsd } from "@/domains/commerce/validation";
import { CheckoutConfirmation } from "@/components/checkout-payment";

export default async function CheckoutQuotePage({ params }: { params: Promise<{ checkoutId: string }> }) {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await requireMember();
  const id = z.uuid().safeParse((await params).checkoutId);
  if (!id.success || !financialServicingEnabled) notFound();
  const quote = await checkoutView(access.user.id, id.data);
  if (!quote) notFound();
  return <div className="site-container max-w-4xl space-y-5 py-8">
    <h1 className="text-display-sm">Confirm USDT purchase</h1>
    {quote.lines.map(line => <article key={line.id} className="surface space-y-3 p-6">
      <h2 className="text-heading-lg">{line.title}</h2>
      <p>{formatUsd(line.priceCents)} reference · {line.amount} USDT charge · Quantity 1 · {line.fulfillment} delivery</p>
      <p className="whitespace-pre-wrap">{line.terms}</p>
    </article>)}
    {newPurchasesEnabled || quote.completed ? <CheckoutConfirmation key={quote.id} id={quote.id} total={quote.total} expiresAt={quote.expiresAt}
      completed={quote.completed} orderIds={quote.lines.flatMap(line => line.orderId ? [line.orderId] : [])} /> : <p>New purchases are paused.</p>}
    <Link href="/account/wallet" className="underline underline-offset-4">View wallet</Link>
  </div>;
}
