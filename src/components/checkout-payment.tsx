"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";

export function CheckoutQuoteButton({ listingIds, fromCart }: { listingIds: string[]; fromCart: boolean }) {
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function quote() {
    if (busy) return;
    requestId.current ??= crypto.randomUUID();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: requestId.current, listingIds, fromCart }) });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const result = z.object({ error: z.string() }).parse(payload);
        setError(result.error); return;
      }
      router.push(`/checkout/${z.object({ id: z.uuid() }).parse(payload).id}`);
    } catch { setError("The quote response is unavailable. Retry this request. No payment is submitted by this button."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3"><Button onClick={quote} disabled={busy || !listingIds.length}>{busy ? "Requesting USDT quote…" : "Review exact USDT charge"}</Button>{error && <p role="alert">{error}</p>}</div>;
}

export function CheckoutConfirmation({ id, total, expiresAt, completed, orderIds }: {
  id: string; total: string; expiresAt: string; completed: boolean; orderIds: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState(orderIds);
  const [accepted, setAccepted] = useState(false);
  async function purchase() {
    if (busy || !accepted) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/checkout/${id}/purchase`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, total }) });
      const payload: unknown = await response.json();
      if (!response.ok) {
        setError(z.object({ error: z.string() }).parse(payload).error); return;
      }
      setOrders(z.object({ orderIds: z.array(z.uuid()).min(1) }).parse(payload).orderIds);
    } catch { setError("The confirmation response was interrupted. Check your orders or retry this same confirmation; do not start another checkout."); }
    finally { setBusy(false); }
  }
  if (completed || orders.length) return <section className="surface space-y-3 p-6">
    <h2 className="text-heading-lg" aria-live="polite">Purchase committed</h2>
    <ul className="space-y-3">{orders.map(order => <li key={order}><Link className="underline underline-offset-4" href={`/account/orders/${order}`}>Open protected order {order}</Link></li>)}</ul>
  </section>;
  return <section className="surface space-y-4 p-6">
    <p className="text-heading-lg">Exact charge: {total} USDT</p>
    <p>Platform purchase fee: 0 USDT. This is a fixed internal USDT transfer for the quoted products. The USD prices are reference prices; the quoted USDT amount uses the observed provider rate.</p>
    <p>Quote expires (UTC): <time dateTime={expiresAt}>{expiresAt}</time>. The server checks expiry and product availability before charging.</p>
    <label className="flex items-start gap-3"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
      <span>I confirm the {total} USDT charge and the purchased delivery terms above.</span>
    </label>
    <Button type="button" disabled={!accepted || busy} onClick={purchase}>{busy ? "Committing purchase…" : `Pay ${total} USDT from balance`}</Button>
    {error && <p role="alert">{error}</p>}
    <Link href="/account/orders" className="block underline underline-offset-4">Check existing orders</Link>
  </section>;
}
