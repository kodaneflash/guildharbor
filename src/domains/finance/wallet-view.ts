import "server-only";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { createReadDatabase } from "@/db/client";
import { financialAccounts, financialActivity, financialCommands, financialDeposits, financialJournals, financialFreezes } from "@/db/schema";
import { formatUsdt } from "./money";
import { financialServicingEnabled } from "./gate";

export async function walletView(ownerId: string) {
  if (!financialServicingEnabled) return null;
  const db = createReadDatabase();
  const debit = alias(financialAccounts, "wallet_debit");
  const credit = alias(financialAccounts, "wallet_credit");
  const [accounts, activity, deposits, journals, freezes] = await Promise.all([
    db.select({ kind: financialAccounts.kind,
      balance: sql<string>`coalesce((select sum(case when j.credit_account_id = ${financialAccounts.id} then j.amount_atoms else -j.amount_atoms end) from ${financialJournals} j where j.credit_account_id = ${financialAccounts.id} or j.debit_account_id = ${financialAccounts.id}), 0)::text`,
    }).from(financialAccounts).where(eq(financialAccounts.ownerId, ownerId)),
    db.select().from(financialActivity).where(eq(financialActivity.memberId, ownerId)).orderBy(desc(financialActivity.createdAt)).limit(100),
    db.select({ id: financialCommands.id, state: financialCommands.state, createdAt: financialCommands.createdAt,
      status: financialDeposits.status, amount: financialDeposits.settledAtoms,
    }).from(financialCommands).leftJoin(financialDeposits, eq(financialDeposits.commandId, financialCommands.id))
      .where(and(eq(financialCommands.ownerId, ownerId), eq(financialCommands.kind, "deposit"))).orderBy(desc(financialCommands.createdAt)).limit(50),
    db.select({ id: financialJournals.id, kind: financialJournals.kind, amount: financialJournals.amountAtoms,
      createdAt: financialJournals.createdAt, debitOwner: debit.ownerId, creditOwner: credit.ownerId,
      from: debit.kind, to: credit.kind }).from(financialJournals)
      .innerJoin(debit, eq(debit.id, financialJournals.debitAccountId)).innerJoin(credit, eq(credit.id, financialJournals.creditAccountId))
      .where(or(eq(debit.ownerId, ownerId), eq(credit.ownerId, ownerId)))
      .orderBy(desc(financialJournals.createdAt), desc(financialJournals.id)).limit(50),
    db.select({ id: financialFreezes.memberId }).from(financialFreezes).where(eq(financialFreezes.memberId, ownerId)),
  ]);
  const balance = (kind: string) => formatUsdt(BigInt(accounts.find(row => row.kind === kind)?.balance ?? "0"));
  return { frozen: Boolean(freezes.length),
    journals: journals.map(row => ({ id: row.id, kind: row.kind, amount: formatUsdt(row.amount), createdAt: row.createdAt.toISOString(),
      direction: row.debitOwner === ownerId && row.creditOwner === ownerId ? "internal" : row.creditOwner === ownerId ? "credit" : "debit", from: row.from, to: row.to })),
    available: balance("available"), pending: balance("pending"), reserved: balance("reserved"),
    activity: activity.map(row => ({ id: row.id, message: row.message, kind: row.kind, createdAt: row.createdAt.toISOString() })),
    deposits: deposits.map(row => ({ id: row.id, status: row.status ?? row.state, createdAt: row.createdAt.toISOString(), credited: row.amount === null ? null : formatUsdt(row.amount) })),
  };
}
