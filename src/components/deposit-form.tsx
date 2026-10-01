"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";

export function DepositForm({ assets }: { assets: { ticker: string; asset: string; network: string }[] }) {
  const router = useRouter();
  const request = useRef<{ requestId: string; priceUsd: string; currency: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const priceUsd = String(form.get("priceUsd") ?? "").trim();
    const currency = String(form.get("currency") ?? "");
    // A failed response is not evidence that creation failed. Keep its identity
    // and original amount for retries rather than silently submitting again.
    if (request.current && (request.current.priceUsd !== priceUsd || request.current.currency !== currency)) {
      setError("Recover your previous request first using its original amount, or check the wallet deposit history."); return;
    }
    request.current ??= { requestId: crypto.randomUUID(), priceUsd, currency };
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/wallet/deposits", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.current) });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const problem = z.object({ error: z.string(), safeToChange: z.boolean().optional() }).safeParse(payload);
        setError(problem.success ? problem.data.error : "Deposit request unavailable. Check your wallet before trying again.");
        if (response.status === 400 || problem.success && problem.data.safeToChange) request.current = null;
        return;
      }
      const result = z.object({ id: z.uuid() }).parse(payload);
      router.push(`/account/wallet/deposits/${result.id}`);
    } catch { setError("Connection interrupted. Retry with the same amount to recover your request; do not send funds yet."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="surface space-y-5 p-6">
    <label className="block space-y-2"><span>Cryptocurrency and network</span>
      <select name="currency" className="w-full rounded-lg border border-border bg-background p-3" defaultValue={assets[0]?.ticker}>
        {assets.map(asset => <option key={asset.ticker} value={asset.ticker}>{asset.asset} — {asset.network === "eth" ? "Ethereum (ERC-20)" : asset.network}</option>)}
      </select>
    </label>
    <label className="block space-y-2"><span>Funding amount (USD reference)</span>
      <input name="priceUsd" inputMode="decimal" autoComplete="off" required maxLength={12} pattern="(?:0|[1-9][0-9]{0,8})(?:\.[0-9]{1,2})?"
        placeholder="20.00" aria-describedby="deposit-price-help" className="w-full rounded-lg border border-border bg-background p-3" />
    </label>
    <p id="deposit-price-help" className="text-body-sm text-text-muted">We request the current equivalent in your selected asset, not a fixed $1 = 1 USDT conversion. Review the exact amount and estimated fees on the next screen before sending anything.</p>
    <p className="text-body-sm text-text-muted">The exchange rate can change while your payment is processed. Your balance receives the USDT actually received after provider fees, which may differ from the estimate. No platform deposit fee. Your sending wallet or exchange may charge a separate network fee.</p>
    {error && <p role="alert">{error}</p>}
    <Button type="submit" disabled={busy || !assets.length}>{busy ? "Creating deposit instructions…" : "Review deposit instructions"}</Button>
  </form>;
}
