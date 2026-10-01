import { USDT_SCALE } from "./money";

export const financialPolicy = Object.freeze({
  version: "2026-10-01-usdt-ethereum-v1",
  asset: "USDT",
  network: "eth",
  providerTicker: "usdterc20",
  chainId: 1,
  tokenContract: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  decimals: 6,
  depositPlatformFeeAtoms: 0n,
  purchasePlatformFeeAtoms: 0n,
  escrowCompletionPlatformFeeAtoms: 0n,
  withdrawalFeeBasisPoints: 100n,
  sellerWithdrawalHoldMs: 24 * 60 * 60 * 1000,
  destinationHoldMs: 24 * 60 * 60 * 1000,
  withdrawalMinimumAtoms: 20n * USDT_SCALE,
  withdrawalMaximumAtoms: 500n * USDT_SCALE,
  withdrawalDailyMaximumAtoms: 1_000n * USDT_SCALE,
});

export type FinancePermission =
  | "finance.treasury"
  | "finance.reconcile"
  | "finance.incident"
  | "finance.approve";

/** Financial authority is explicit; admin.manage deliberately grants none. */
export function assertFinancePermission(permissions: readonly string[], required: FinancePermission) {
  if (!permissions.includes(required)) throw new Error("FORBIDDEN");
}

export function assertIndependentApproval(proposerId: string, approverId: string, beneficiaryId: string) {
  if (proposerId === approverId || approverId === beneficiaryId || proposerId === beneficiaryId) {
    throw new Error("Independent financial approval required.");
  }
}

export function validateWithdrawalLimit(debitAtoms: bigint, rollingDayDebitAtoms: bigint) {
  if (debitAtoms < financialPolicy.withdrawalMinimumAtoms) throw new Error("Minimum withdrawal is 20 USDT.");
  if (debitAtoms > financialPolicy.withdrawalMaximumAtoms) throw new Error("Maximum withdrawal is 500 USDT.");
  if (rollingDayDebitAtoms < 0n) throw new Error("Invalid withdrawal history.");
  if (rollingDayDebitAtoms + debitAtoms > financialPolicy.withdrawalDailyMaximumAtoms) {
    throw new Error("Rolling 24-hour withdrawal limit is 1,000 USDT, including pending requests.");
  }
}
