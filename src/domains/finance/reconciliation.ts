import "server-only";
import { sql } from "drizzle-orm";
import { financialAccounts, financialJournals } from "@/db/schema";
import { createReadDatabase } from "@/db/client";
import { financialPolicy } from "./policy";

/** Read-only internal accounting check. Provider backing is deliberately a
 * separate result: balanced books alone are not evidence of custody funds.
 */
export async function reconcileLedger() {
  const database = createReadDatabase();
  const rows = await database.select({
    id: financialAccounts.id,
    kind: financialAccounts.kind,
    currency: financialAccounts.currency,
    balance: sql<string>`coalesce((select sum(case when j.credit_account_id = ${financialAccounts.id} then j.amount_atoms else -j.amount_atoms end) from ${financialJournals} j where j.credit_account_id = ${financialAccounts.id} or j.debit_account_id = ${financialAccounts.id}), 0)::text`,
  }).from(financialAccounts);
  let liabilities = 0n;
  let backingBookBalance = 0n;
  let platformRevenue = 0n;
  const issues: { accountId: string; reason: string }[] = [];
  for (const row of rows) {
    if (row.currency !== financialPolicy.asset) issues.push({ accountId: row.id, reason: "unexpected_currency" });
    const balance = BigInt(row.balance);
    if (row.kind === "backing") backingBookBalance += balance;
    else if (row.kind === "platform_revenue") {
      platformRevenue += balance;
      if (balance < 0n) issues.push({ accountId: row.id, reason: "negative_platform_revenue" });
    }
    else {
      liabilities += balance;
      if (balance < 0n) issues.push({ accountId: row.id, reason: "negative_member_balance" });
    }
  }
  const balanced = liabilities + platformRevenue + backingBookBalance === 0n;
  return {
    currency: "USDT",
    memberLiabilityAtoms: liabilities.toString(),
    platformRevenueAtoms: platformRevenue.toString(),
    backingBookAtoms: (-backingBookBalance).toString(),
    balanced,
    issues,
    providerBackingVerified: false,
    financialExecutionEnabled: false,
  };
}

/** Read-only point-in-time custody comparison. It does not establish the
 * attribution or finality of an individual deposit. No journal repair occurs. */
export async function reconcileCustody() {
  const { nowPaymentsDepositConfig } = await import("./config");
  const { readCustodyBacking } = await import("./deposit-provider");
  const config = nowPaymentsDepositConfig();
  const [ledger, backing] = await Promise.all([reconcileLedger(), readCustodyBacking(config.apiKey, config.ticker)]);
  const required = BigInt(ledger.memberLiabilityAtoms) + BigInt(ledger.platformRevenueAtoms);
  return { ...ledger, providerAvailableAtoms: backing.atoms.toString(), observedAt: new Date().toISOString(),
    providerBackingVerified: ledger.balanced && ledger.issues.length === 0 && required >= 0n && backing.atoms >= required };
}
