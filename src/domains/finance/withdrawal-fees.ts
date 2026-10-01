import { MAX_ATOMS, parseUsdt, positiveUsdt } from "./money";
import { financialPolicy, validateWithdrawalLimit } from "./policy";

/** Pure breakdown, not a provider quote or authority to reserve/withdraw funds.
 * The entered amount is the TOTAL balance debit; fees are deducted from it.
 * Third-party fees must be an independently verified combined USDT cost, not
 * a client-supplied guess. Missing fees must not silently default to zero.
 */
export function withdrawalBreakdown(input: {
  debitAmount: string;
  providerAndNetworkFeeAmount: string;
  rollingDayDebitAtoms: bigint;
}) {
  const debitAtoms = positiveUsdt(input.debitAmount);
  const providerAndNetworkFeeAtoms = parseUsdt(input.providerAndNetworkFeeAmount);
  validateWithdrawalLimit(debitAtoms, input.rollingDayDebitAtoms);
  // Integer truncation deliberately rounds DOWN to a micro-USDT so the fee
  // never exceeds 1%. It is deducted once, not charged again on provider fees.
  const platformFeeAtoms = debitAtoms * financialPolicy.withdrawalFeeBasisPoints / 10_000n;
  const recipientAtoms = debitAtoms - platformFeeAtoms - providerAndNetworkFeeAtoms;
  if (recipientAtoms <= 0n || recipientAtoms > MAX_ATOMS) throw new Error("Withdrawal fees leave no payable amount.");
  return {
    policyVersion: financialPolicy.version,
    debitAtoms,
    platformFeeAtoms,
    providerAndNetworkFeeAtoms,
    recipientAtoms,
    externalDebitAtoms: debitAtoms - platformFeeAtoms,
  };
}
