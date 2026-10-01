import "server-only";

/** Activation authorized by the owner. Provider configuration, asset approval,
 * final settlement and backing checks still apply to every payment. */
export const financialExecutionEnabled = true;
export const financialServicingEnabled = true;

/** After acceptance, pause new deposits/purchases independently of servicing
 * existing obligations, callbacks, delivery and seller holds. */
export const newDepositsEnabled = financialExecutionEnabled && financialServicingEnabled;
export const newPurchasesEnabled = financialExecutionEnabled && financialServicingEnabled;
export function assertFinancialExecutionEnabled(): void {
  if (!financialExecutionEnabled || !financialServicingEnabled) {
    throw new Error("Financial execution is unavailable.");
  }
}
