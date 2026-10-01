import "server-only";
import { z } from "zod";
import { financialPolicy } from "./policy";

const assetSchema = z.object({
  ticker: z.string().regex(/^[a-z0-9]{1,40}$/),
  asset: z.string().regex(/^[A-Z0-9]{1,20}$/),
  network: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  decimals: z.number().int().min(0).max(18),
  tokenContract: z.string().max(200).nullable(),
  memoRequired: z.boolean(),
  verificationReference: z.string().trim().min(10).max(200),
}).strict();
export type ApprovedDepositAsset = z.infer<typeof assetSchema>;

/** This is an operator's evidence-backed approval, not coin discovery or an
 * activation switch. Empty configuration exposes no unverified payment option. */
export function approvedDepositAssets(): ApprovedDepositAsset[] {
  const raw = process.env.NOWPAYMENTS_APPROVED_ASSETS;
  if (!raw) return [];
  const parsed = z.array(assetSchema).min(1).max(2).safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("Merchant asset approval configuration is invalid.");
  const assets = parsed.data;
  const [settlement, additional] = assets;
  if (settlement.asset !== financialPolicy.asset || settlement.network !== financialPolicy.network || settlement.decimals !== financialPolicy.decimals ||
    settlement.tokenContract?.toLowerCase() !== financialPolicy.tokenContract.toLowerCase() || settlement.memoRequired ||
    settlement.ticker !== financialPolicy.providerTicker || settlement.ticker !== process.env.NOWPAYMENTS_SETTLEMENT_TICKER || additional?.ticker === settlement.ticker) {
    throw new Error("Approved deposit assets must contain USDT/Ethereum and at most one verified conversion pair.");
  }
  return assets;
}

export function approvedDepositAsset(ticker: string) {
  const asset = approvedDepositAssets().find(asset => asset.ticker === ticker);
  if (!asset) throw new Error("Deposit asset has not been approved for this merchant.");
  return asset;
}
