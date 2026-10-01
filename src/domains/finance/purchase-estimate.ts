import "server-only";
import { z } from "zod";
import { formatUsdt, MAX_ATOMS, positiveUsdt } from "./money";
import { parseProviderJson, ProviderReadError, readProviderBody } from "./nowpayments";
import { financialPolicy } from "./policy";

const responseSchema = z.object({
  currency_from: z.literal("usd"),
  amount_from: z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/).max(100),
  currency_to: z.string(),
  estimated_amount: z.string(),
});

export function usdAmountFromCents(cents: bigint): string {
  if (cents <= 0n || cents > MAX_ATOMS) throw new Error("Invalid USD purchase amount.");
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/** An estimate is NOT payment evidence, a reserved rate or an executable quote.
 * The caller supplies the account-verified USDT/Ethereum ticker, never one
 * selected by a browser. Merchant capability checks remain an activation gate.
 * Internal purchases transfer existing USDT; this GET creates no chain payment.
 */
export async function estimateUsdPurchase(input: {
  priceCents: bigint;
  verifiedSettlementTicker: string;
  apiKey: string;
}) {
  const usdAmount = usdAmountFromCents(input.priceCents);
  const ticker = z.literal(financialPolicy.providerTicker).parse(input.verifiedSettlementTicker);
  if (!input.apiKey) throw new Error("NOWPayments API key unavailable.");
  const query = new URLSearchParams({ amount: usdAmount, currency_from: "usd", currency_to: ticker });
  let response: Response;
  try {
    response = await fetch(`https://api.nowpayments.io/v1/estimate?${query}`, {
      headers: { "x-api-key": input.apiKey, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ProviderReadError("transport");
  }
  if (!response.ok) throw new ProviderReadError("http");
  const body = await readProviderBody(response);
  let payload: unknown;
  try {
    payload = parseProviderJson(body);
  } catch {
    throw new ProviderReadError("invalid_evidence");
  }
  const result = responseSchema.safeParse(payload);
  if (!result.success || result.data.currency_to !== ticker) throw new ProviderReadError("invalid_evidence");
  // Compare the echoed USD value exactly, accepting only extra zero decimals.
  const [whole, fraction = ""] = result.data.amount_from.split(".");
  if (/[1-9]/.test(fraction.slice(2)) || BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, "0")) !== input.priceCents) {
    throw new ProviderReadError("invalid_evidence");
  }
  let atoms: bigint;
  try {
    atoms = positiveUsdt(result.data.estimated_amount);
  } catch {
    // Never silently round an unrepresentable provider estimate into a debit.
    throw new ProviderReadError("invalid_evidence");
  }
  return {
    evidenceBody: body,
    kind: "indicative" as const,
    priceCurrency: "USD" as const,
    priceAmount: usdAmount,
    settlementCurrency: "USDT" as const,
    network: "eth" as const,
    estimatedAmount: formatUsdt(atoms),
    excludesFees: true as const,
    executable: false as const,
    observedAt: new Date().toISOString(),
  };
}
