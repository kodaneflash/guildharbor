import { notFound } from "next/navigation";
import { z } from "zod";
import { newPurchasesEnabled } from "@/domains/finance/gate";
import { CheckoutSummary } from "@/components/checkout-summary";
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ listing?: string; item?: string | string[]; fromCart?: string }> }) {
  const { listing, item, fromCart } = await searchParams;
  const selectedCartIds = fromCart === "1" ? typeof item === "string" ? [item] : item ?? [] : undefined;
  if (selectedCartIds && !z.array(z.uuid()).max(100).safeParse(selectedCartIds).success) notFound();
  if (listing && !z.uuid().safeParse(listing).success) notFound();
  return <div className="site-container max-w-4xl space-y-5 py-8">
    <h1 className="text-display-sm">Review purchase</h1>
    <p>{newPurchasesEnabled ? "Review the exact USDT charge before confirming payment." : "Review only — payments are not available."}</p>
    <p>Prices are in USD. When payments become available, checkout will show the exact USDT amount and applicable fees for your confirmation. USDT is not assumed to equal one US dollar. Requesting a quote does not charge your wallet.</p>
    <CheckoutSummary listingId={listing} selectedCartIds={selectedCartIds} />
  </div>;
}
