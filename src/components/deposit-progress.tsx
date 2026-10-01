"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const viewSchema = z.object({ id: z.uuid(), status: z.string(), creditedAmount: z.string().nullable().optional(),
  instructions: z.object({ asset: z.string(), network: z.string(), amount: z.string(), address: z.string(), memo: z.string().nullable(),
    priceUsd: z.string().nullable(), minimum: z.string(), estimatedNet: z.string().nullable(), estimatedFee: z.string().nullable(), expiresAt: z.string() }).nullable(),
});
type DepositView = z.infer<typeof viewSchema>;
const labels: Record<string, string> = {
  preparing: "Preparing instructions", outcome_unknown: "Request awaiting recovery — do not submit another payment",
  awaiting_payment: "Awaiting payment", detected: "Payment detected", confirming: "Confirming payment",
  eligible_for_reconciliation: "Checking settled funds", completed: "Completed", expired: "Quote expired — do not send funds",
  partial_payment: "Partial payment — manual review", overpayment: "Overpayment — manual review",
  late_payment: "Late payment — manual review", failed_payment: "Payment failed — contact support",
  wrong_asset_or_network: "Wrong asset or network — manual review", manual_review: "Manual review required",
};

export function DepositProgress({ initial }: { initial: DepositView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/wallet/deposits/${initial.id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Status unavailable");
        const current = viewSchema.parse(await response.json());
        setView(current); setError("");
        if (current.status === "completed") return;
      } catch {
        if (controller.signal.aborted) return;
        setError("Status updates are unavailable. Your recorded deposit is preserved; do not pay again.");
      }
      timer = setTimeout(poll, 20_000);
    }
    timer = setTimeout(poll, 20_000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [initial.id]);
  useEffect(() => {
    if (!view.instructions) return;
    const remaining = new Date(view.instructions.expiresAt).getTime() - Date.now();
    const timer = setTimeout(() => setExpired(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [view.instructions]);
  async function refresh() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/wallet/deposits/${view.id}`, { method: "POST" });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const problem = z.object({ error: z.string() }).safeParse(payload);
        setError(problem.success ? problem.data.error : "Status unavailable. Do not pay again."); return;
      }
      setView(viewSchema.parse(payload));
    } catch { setError("Connection interrupted. Your recorded deposit is preserved; do not pay again."); }
    finally { setBusy(false); }
  }
  const instructions = expired ? null : view.instructions;
  const network = instructions?.network === "eth" ? "Ethereum (ERC-20)" : instructions?.network;
  return <div className="space-y-5">
    <section className="surface space-y-3 p-6" aria-labelledby="deposit-status">
      <h2 id="deposit-status" className="text-heading-lg" aria-live="polite">{expired && view.status === "awaiting_payment" ? labels.expired : labels[view.status] ?? labels.manual_review}</h2>
      {view.creditedAmount && <p>{view.creditedAmount} USDT credited after fees.</p>}
      <p className="text-body-sm text-text-muted">You may close this page. Processing continues on the server. A detected payment is not yet a spendable balance.</p>
      <Button type="button" onClick={refresh} disabled={busy}>{busy ? "Checking…" : "Refresh provider status"}</Button>
      {error && <p role="alert">{error}</p>}
    </section>
    {instructions && <section className="surface space-y-5 p-6" aria-labelledby="deposit-instructions">
      <h2 id="deposit-instructions" className="text-heading-lg">Send exactly {instructions.amount} {instructions.asset} on {network}</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div><dt>Requested USD reference</dt><dd>${instructions.priceUsd}</dd></div>
        <div><dt>Minimum deposit</dt><dd>{instructions.minimum} {instructions.asset}</dd></div>
        <div><dt>Estimated provider costs deducted</dt><dd>{instructions.estimatedFee === null ? "Unavailable; final net settlement determines the credit" : `${instructions.estimatedFee} USDT`}</dd></div>
        <div><dt>Estimated balance credit</dt><dd>{instructions.estimatedNet === null ? "Unavailable until the provider supplies settlement evidence" : `${instructions.estimatedNet} USDT (estimate)`}</dd></div>
        <div><dt>Platform deposit fee</dt><dd>0 USDT</dd></div>
        <div><dt>Quote expires (UTC)</dt><dd><time dateTime={instructions.expiresAt}>{instructions.expiresAt}</time></dd></div>
      </dl>
      <p>Only send {instructions.asset} on {network}. A matching address format does not mean another asset or network is supported. Use this address once and send the exact amount before expiry.</p>
      <Image unoptimized src={`/api/wallet/deposits/${view.id}/qr`} alt={`Deposit address QR code. Select ${instructions.asset} on ${network} and enter the exact amount separately.`} width={288} height={288} />
      <p className="text-body-sm text-text-muted">The QR contains the address only. Verify the network, token and amount in your sending wallet. Its network fee is separate and determined by that wallet.</p>
      <p className="break-all font-mono">{instructions.address}</p>
      {instructions.memo && <p>Required memo/tag: <span className="font-mono">{instructions.memo}</span></p>}
      <Button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(instructions.address); setCopied(true); }
        catch { setError("Clipboard unavailable. Select and copy the displayed address."); }
      }}>Copy address</Button>
      <span role="status" className="ml-3">{copied ? "Address copied" : ""}</span>
      <p className="text-body-sm text-text-muted">Actual settled proceeds determine your credit. Partial, excess, late or wrong-asset payments require review; do not send an additional transfer to fix them.</p>
    </section>}
    {!instructions && view.status !== "completed" && <p>Do not send funds using old instructions. If you already paid, keep your transaction hash and contact support with deposit reference {view.id}.</p>}
    <Link className="underline underline-offset-4" href="/account/wallet">Return to wallet and transaction history</Link>
  </div>;
}
