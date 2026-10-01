import "server-only";
import { LosslessNumber, stringify } from "lossless-json";
import { z } from "zod";
import { approvedDepositAsset, type ApprovedDepositAsset } from "./assets";
import { parseAssetAmount, parseUsdt } from "./money";
import { parseProviderJson, ProviderReadError, readProviderBody } from "./nowpayments";
import { financialPolicy } from "./policy";

export const depositRequestSchema = z.object({
  requestId: z.uuid(),
  priceUsd: z.string().regex(/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/)
    .refine(value => /[1-9]/.test(value), "Enter a positive USD amount."),
  currency: z.string().regex(/^[a-z0-9]{1,40}$/),
}).strict();
const decimal = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/).max(100);
const providerDate = z.string().datetime({ offset: true });
export const instructionsSchema = z.object({
  payment_id: z.string().regex(/^\d{1,40}$/), order_id: z.uuid(),
  payment_status: z.string(), price_amount: decimal, price_currency: z.literal("usd"),
  pay_currency: z.string(), outcome_currency: z.string(), pay_address: z.string().min(1).max(250),
  pay_amount: decimal, amount_received: decimal.nullish(),
  payin_extra_id: z.string().max(250).nullish(),
  network: z.string(), network_precision: z.string(),
  smart_contract: z.string().nullish(), expiration_estimate_date: providerDate.nullish(), valid_until: providerDate.nullish(),
  is_fixed_rate: z.union([z.literal(true), z.literal("true"), z.literal("True")]),
  is_fee_paid_by_user: z.union([z.literal(false), z.literal("false"), z.literal("False")]),
});

/** Fixed origin, bounded responses and no retries, especially for POST. */
async function providerRequest(path: string, apiKey: string, body?: string) {
  let response: Response;
  try {
    response = await fetch(`https://api.nowpayments.io/v1/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "x-api-key": apiKey, Accept: "application/json", "Content-Type": "application/json" },
      body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new ProviderReadError("transport"); }
  if (!response.ok) throw new ProviderReadError("http");
  const raw = await readProviderBody(response);
  let data: unknown;
  try { data = parseProviderJson(raw); }
  catch { throw new ProviderReadError("invalid_evidence"); }
  return { raw, data };
}

export async function depositCapability(apiKey: string, ticker: string, settlementTicker: string = financialPolicy.providerTicker) {
  z.literal(financialPolicy.providerTicker).parse(settlementTicker);
  const asset = approvedDepositAsset(ticker);
  const settlement = approvedDepositAsset(settlementTicker);
  const [full, enabled, fixed, minimum] = await Promise.all([
    providerRequest("full-currencies", apiKey), providerRequest("merchant/coins", apiKey),
    providerRequest("currencies?fixed_rate=true", apiKey),
    providerRequest(`min-amount?currency_from=${ticker}&currency_to=${settlementTicker}&is_fixed_rate=true&is_fee_paid_by_user=false`, apiKey),
  ]);
  const coins = z.object({ currencies: z.array(z.object({ code: z.string() }).passthrough()) }).parse(full.data);
  const merchant = z.object({ selectedCurrencies: z.array(z.string()) }).parse(enabled.data);
  const fixedCurrencies = z.object({ currencies: z.array(z.object({ currency: z.string() })) }).parse(fixed.data);
  const coinSchema = z.object({ code: z.string(), enable: z.boolean(), network: z.string(),
    smart_contract: z.string().nullable(), network_precision: z.string().nullable(), extra_id_exists: z.boolean() });
  const coin = coinSchema.parse(coins.currencies.find(value => value.code.toLowerCase() === ticker));
  const outcome = coinSchema.parse(coins.currencies.find(value => value.code.toLowerCase() === settlementTicker));
  const matches = (coin: z.infer<typeof coinSchema>, expected: ApprovedDepositAsset) => coin.enable &&
    coin.network === expected.network && coin.network_precision === String(expected.decimals) &&
    (coin.smart_contract || null)?.toLowerCase() === expected.tokenContract?.toLowerCase() && coin.extra_id_exists === expected.memoRequired;
  if (!matches(coin, asset) || !matches(outcome, settlement) ||
    ![ticker, settlementTicker].every(required => merchant.selectedCurrencies.some(value => value.toLowerCase() === required)) ||
    ![ticker, settlementTicker].every(required => fixedCurrencies.currencies.some(value => value.currency.toLowerCase() === required))) {
    throw new ProviderReadError("invalid_evidence");
  }
  const min = z.object({ currency_from: z.literal(ticker), currency_to: z.literal(settlementTicker), min_amount: decimal }).parse(minimum.data);
  const atoms = parseAssetAmount(min.min_amount, asset.decimals);
  if (atoms <= 0n) throw new ProviderReadError("invalid_evidence");
  return atoms;
}

export async function createDirectDeposit(input: { apiKey: string; ticker: string; callbackUrl: string; commandId: string; priceUsd: string }) {
  // Serialize an exact decimal JSON number, never a JavaScript monetary number.
  const body = stringify({ price_amount: new LosslessNumber(input.priceUsd), price_currency: "usd", pay_currency: input.ticker,
    order_id: input.commandId, ipn_callback_url: input.callbackUrl, is_fixed_rate: true, is_fee_paid_by_user: false });
  if (!body) throw new Error("Payment request unavailable.");
  return providerRequest("payment", input.apiKey, body);
}

export async function readCustodyBacking(apiKey: string, ticker: string) {
  z.literal(financialPolicy.providerTicker).parse(ticker);
  const result = await providerRequest("balance", apiKey);
  const balances = z.record(z.string(), z.unknown()).parse(result.data);
  const balance = z.object({ amount: decimal, pendingAmount: decimal }).parse(balances[ticker]);
  return { raw: result.raw, atoms: parseUsdt(balance.amount) };
}

export async function readDirectDeposit(paymentId: string, apiKey: string) {
  z.string().regex(/^\d{1,40}$/).parse(paymentId);
  return providerRequest(`payment/${paymentId}`, apiKey);
}

/** Listing requires a short-lived merchant JWT in addition to the API key.
 * Absence is an explicit operator recovery requirement, never nonpayment. */
export async function discoverDepositPayments(apiKey: string, reference: string, createdAt: Date) {
  const jwt = process.env.NOWPAYMENTS_READ_JWT;
  if (!jwt) throw new Error("Payment discovery requires merchant read authentication; use operator recovery.");
  const query = new URLSearchParams({ limit: "500", page: "0", sortBy: "created_at", orderBy: "asc",
    dateFrom: new Date(createdAt.getTime() - 60_000).toISOString(), dateTo: new Date(createdAt.getTime() + 300_000).toISOString() });
  const response = await fetch(`https://api.nowpayments.io/v1/payment/?${query}`, {
    headers: { "x-api-key": apiKey, Authorization: `Bearer ${jwt}`, Accept: "application/json" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ProviderReadError("http");
  const raw = await readProviderBody(response);
  const data = z.object({ data: z.array(z.object({ payment_id: z.string().regex(/^\d{1,40}$/), order_id: z.string().nullable() })),
    pagesCount: z.string().regex(/^\d+$/) }).parse(parseProviderJson(raw));
  if (BigInt(data.pagesCount) > 1n) throw new Error("Payment discovery window requires operator review; no payment is assumed absent.");
  return data.data.filter(payment => payment.order_id === reference);
}

/** Reject known below-minimum requests before claiming a provider mutation. */
export async function estimateDepositPayin(apiKey: string, ticker: string, priceUsd: string) {
  const asset = approvedDepositAsset(ticker);
  const query = new URLSearchParams({ amount: priceUsd, currency_from: "usd", currency_to: ticker });
  const response = await providerRequest(`estimate?${query}`, apiKey);
  const data = z.object({ currency_from: z.literal("usd"), currency_to: z.literal(ticker),
    amount_from: decimal, estimated_amount: decimal }).parse(response.data);
  if (parseAssetAmount(data.amount_from, 2) !== parseAssetAmount(priceUsd, 2)) throw new ProviderReadError("invalid_evidence");
  return parseAssetAmount(data.estimated_amount, asset.decimals);
}
