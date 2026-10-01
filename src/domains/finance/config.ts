import "server-only";
import { z } from "zod";
import { financialPolicy } from "./policy";

const evidenceSchema = z.object({
  keyHex: z.string().regex(/^[a-f0-9]{64}$/i),
  keyVersion: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  ipnSecret: z.string().min(1),
});

export function financialEvidenceConfig() {
  const result = evidenceSchema.safeParse({
    keyHex: process.env.FINANCIAL_EVIDENCE_ENCRYPTION_KEY,
    keyVersion: process.env.FINANCIAL_EVIDENCE_KEY_VERSION,
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET,
  });
  // Never include validation input or secret values in errors.
  if (!result.success) throw new Error("Financial evidence configuration is incomplete.");
  return result.data;
}

export function nowPaymentsDepositConfig() {
  const result = z.object({ apiKey: z.string().min(1), ticker: z.literal(financialPolicy.providerTicker),
    callbackUrl: z.url().refine(value => {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
        && url.pathname === "/api/payments/nowpayments/ipn";
    }),
  }).safeParse({ apiKey: process.env.NOWPAYMENTS_API_KEY,
    ticker: process.env.NOWPAYMENTS_SETTLEMENT_TICKER, callbackUrl: process.env.NOWPAYMENTS_IPN_CALLBACK_URL });
  if (!result.success) throw new Error("NOWPayments deposit configuration is incomplete.");
  return { ...result.data, ...financialEvidenceConfig() };
}
