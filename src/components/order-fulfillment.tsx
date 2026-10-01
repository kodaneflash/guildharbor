"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";

export function OrderFulfillment({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const content = String(new FormData(event.currentTarget).get("content") ?? "");
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/seller/orders/${orderId}/fulfillment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      if (!response.ok) { setError(z.object({ error: z.string() }).parse(await response.json()).error); return; }
      router.refresh();
    } catch { setError("The response was interrupted. Retry with the same fulfillment text or refresh to check the committed order."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-3">
    <label className="block space-y-2"><span>Protected fulfillment details</span><textarea name="content" required maxLength={100000} rows={5}
      aria-describedby={`fulfillment-help-${orderId}`} className="w-full rounded-lg border border-border bg-background p-3" /></label>
    <p id={`fulfillment-help-${orderId}`} className="text-body-sm text-text-muted">Provide the purchased service result or delivery details. Only the buyer can download this fulfillment. Submitted fulfillment cannot be replaced; use existing messages for follow-up.</p>
    <Button type="submit" disabled={busy}>{busy ? "Saving fulfillment…" : "Submit fulfillment and complete order"}</Button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
