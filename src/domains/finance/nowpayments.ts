import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isSafeNumber, parse } from "lossless-json";
import { z } from "zod";
import { parseAssetAmount, parseUsdt } from "./money";

const identifier = z.string().regex(/^\d{1,40}$/);
const decimal = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/).max(100);
export const paymentEvidenceSchema = z.object({
  payment_id: identifier,
  payment_status: z.string().min(1).max(40),
  order_id: z.string().min(1).max(200),
  pay_currency: z.string().min(1).max(40),
  outcome_currency: z.string().min(1).max(40),
  pay_amount: decimal,
  actually_paid: decimal.nullable(),
  outcome_amount: decimal.nullable(),
  pay_address: z.string().min(1).max(250),
  payin_extra_id: z.string().max(250).nullable(),
  parent_payment_id: identifier.nullish(),
  payin_hash: z.string().max(250).nullish(),
  payout_hash: z.string().max(250).nullish(),
  payment_extra_ids: z.array(identifier).optional(),
});
export type PaymentEvidence = z.infer<typeof paymentEvidenceSchema>;

/** Numeric JSON lexemes never pass through binary floating point for accounting. */
export function parseProviderJson(body: string, requireSignatureRoundTrip = false): unknown {
  if (Buffer.byteLength(body, "utf8") > 262_144) throw new Error("Provider evidence exceeds size limit.");
  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (const character of body) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') quoted = true;
    else if (character === "{" || character === "[") {
      depth++;
      if (depth > 32) throw new Error("Provider evidence exceeds nesting limit.");
    } else if (character === "}" || character === "]") depth--;
  }
  return parse(body, undefined, { parseNumber: value => {
    // HMAC canonicalization uses the provider's native JSON serialization.
    // Reject numeric lexemes that would change value during that serialization:
    // otherwise different exact amounts could authenticate with the same HMAC.
    if (requireSignatureRoundTrip && !isSafeNumber(value)) throw new Error("Ambiguous signature number.");
    return value;
  } });
}

// Matches the recursive Node example in the current Postman documentation.
// Array-containing live vectors must pass acceptance before activation.
function documentedSort(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error("Provider evidence exceeds nesting limit.");
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, child]) => [key, documentedSort(child, depth + 1)]));
}

export function verifyIpn(body: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature) || !secret) return null;
  // Validates size and rejects duplicate keys before native parsing for the
  // provider's prescribed signature serialization. Native values are not money.
  let exact: unknown;
  try {
    exact = parseProviderJson(body, true);
  } catch {
    return null;
  }
  if (!exact || typeof exact !== "object" || Array.isArray(exact)) return null;
  const canonical = JSON.stringify(documentedSort(JSON.parse(body)));
  const expected = createHmac("sha512", secret).update(canonical).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return null;
  return { payload: exact, digest: createHash("sha256").update(canonical).digest("hex") };
}

export type DepositDisposition =
  | "awaiting_payment" | "detected" | "confirming" | "eligible_for_reconciliation"
  | "expired" | "partial_payment" | "overpayment" | "late_payment"
  | "failed_payment" | "wrong_asset_or_network" | "manual_review";

export function classifyDeposit(evidence: PaymentEvidence, expected: {
  paymentId: string; reference: string; currency: string; address: string;
  memo: string | null; requestedAtoms: bigint; settlementCurrency?: string; decimals?: number; quoteExpiredBeforeDetection: boolean;
}): DepositDisposition {
  if (evidence.payment_id !== expected.paymentId || evidence.order_id !== expected.reference ||
    evidence.parent_payment_id || evidence.payment_extra_ids?.length || evidence.pay_address !== expected.address || evidence.payin_extra_id !== expected.memo) return "manual_review";
  // Pay-in and settlement tickers identify separate assets, never equal units.
  if (evidence.pay_currency !== expected.currency || evidence.outcome_currency !== (expected.settlementCurrency ?? expected.currency)) return "wrong_asset_or_network";
  let quoted: bigint;
  let actual: bigint;
  let settled: bigint;
  try {
    quoted = parseAssetAmount(evidence.pay_amount, expected.decimals ?? 6);
    actual = evidence.actually_paid === null ? 0n : parseAssetAmount(evidence.actually_paid, expected.decimals ?? 6);
    settled = evidence.outcome_amount === null ? 0n : parseUsdt(evidence.outcome_amount);
  } catch {
    // Unsupported precision or out-of-range evidence is an exception, never a
    // rounded amount or an uncaught error that hides a reconciliation item.
    return "manual_review";
  }
  if (quoted <= 0n) return "manual_review";
  if (quoted !== expected.requestedAtoms) return "manual_review";
  if (actual > 0n && expected.quoteExpiredBeforeDetection) return "late_payment";
  if (actual > quoted) return "overpayment";
  if (evidence.payment_status === "partially_paid" || actual > 0n && actual < quoted) return "partial_payment";
  switch (evidence.payment_status) {
    case "waiting": return actual > 0n ? "detected" : "awaiting_payment";
    case "confirming":
    case "confirmed":
    case "sending": return "confirming";
    case "expired": return actual > 0n ? "manual_review" : "expired";
    case "failed": return "failed_payment";
    case "finished": {
      if (!evidence.payin_hash || actual !== quoted) return "manual_review";
      return settled > 0n && (expected.currency !== (expected.settlementCurrency ?? expected.currency) || settled <= actual) ? "eligible_for_reconciliation" : "manual_review";
    }
    default: return "manual_review";
  }
}

export function payoutDisposition(status: string): "completed_evidence" | "rejected_evidence" | "retain_reservation" {
  if (status.toLowerCase() === "finished") return "completed_evidence";
  if (status.toLowerCase() === "rejected") return "rejected_evidence";
  // Failed, unverified, unknown and cancelled records never release funds here.
  return "retain_reservation";
}

export class ProviderReadError extends Error {
  constructor(readonly category: "http" | "transport" | "invalid_evidence") {
    super(`NOWPayments lookup failed: ${category}`);
  }
}

/** Bound the stream before allocating a complete response body. */
export async function readProviderBody(response: Response): Promise<string> {
  if (!response.body) throw new ProviderReadError("invalid_evidence");
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let length = 0;
  let body = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 262_144) {
        await reader.cancel();
        throw new ProviderReadError("invalid_evidence");
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    return body + decoder.decode();
  } catch (error) {
    if (error instanceof ProviderReadError) throw error;
    throw new ProviderReadError("transport");
  } finally {
    reader.releaseLock();
  }
}

/** Read-only boundary. Payment creation requires a durable command service.
 * No caller-controlled origin, redirects, credential logging or mutation retry.
 */
export async function lookupPayment(paymentId: string, apiKey: string): Promise<PaymentEvidence> {
  identifier.parse(paymentId);
  if (!apiKey) throw new Error("NOWPayments API key unavailable.");
  let response: Response;
  try {
    response = await fetch(`https://api.nowpayments.io/v1/payment/${paymentId}`, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
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
  const result = paymentEvidenceSchema.safeParse(payload);
  if (!result.success || result.data.payment_id !== paymentId) throw new ProviderReadError("invalid_evidence");
  return result.data;
}
