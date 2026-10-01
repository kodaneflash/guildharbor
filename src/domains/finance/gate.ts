import "server-only";

/** Acceptance must change this source boundary in a separately approved release.
 * Credentials and environment toggles cannot activate financial execution. */
export const financialExecutionEnabled = false;
export const financialServicingEnabled = false;

/** After acceptance, pause new deposits/purchases independently of servicing
 * existing obligations, callbacks, delivery and seller holds. */
export const newDepositsEnabled = financialExecutionEnabled && financialServicingEnabled;
export const newPurchasesEnabled = financialExecutionEnabled && financialServicingEnabled;
export function assertFinancialExecutionEnabled(): never {
  throw new Error("Financial execution is unavailable pending acceptance and merchant capability verification.");
}
