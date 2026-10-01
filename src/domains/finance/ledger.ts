import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { FinanceTransaction } from "./database";
import { financialAccounts, financialJournals } from "@/db/schema";
import { MAX_ATOMS } from "./money";
import { financialPolicy } from "./policy";

export type JournalInput = Pick<typeof financialJournals.$inferInsert,
  "reference" | "debitAccountId" | "creditAccountId" | "amountAtoms" | "kind" | "actorId" | "evidenceReference" | "reversalOfId">;

/** Internal transaction primitive, never a browser/server-action entry point.
 * The caller must establish authority, evidence and business state first.
 * The database independently enforces balance/immutability/sufficient funds.
 */
export async function postJournal(tx: FinanceTransaction, input: JournalInput) {
  if (input.amountAtoms <= 0n || input.amountAtoms > MAX_ATOMS) throw new Error("Invalid journal amount.");
  if (input.debitAccountId === input.creditAccountId) throw new Error("Journal accounts must differ.");
  // Serialize retries even when they target different accounts maliciously.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.reference}, 0))`);
  const [existing] = await tx.select().from(financialJournals).where(eq(financialJournals.reference, input.reference));
  if (existing) {
    if (existing.debitAccountId !== input.debitAccountId || existing.creditAccountId !== input.creditAccountId ||
      existing.amountAtoms !== input.amountAtoms || existing.kind !== input.kind || existing.actorId !== input.actorId ||
      existing.evidenceReference !== input.evidenceReference || existing.reversalOfId !== (input.reversalOfId ?? null)) {
      throw new Error("Financial reference reused with different instructions.");
    }
    return existing;
  }
  await tx.select({ id: financialAccounts.id }).from(financialAccounts)
    .where(inArray(financialAccounts.id, [input.debitAccountId, input.creditAccountId]))
    .orderBy(financialAccounts.id).for("update");
  const [journal] = await tx.insert(financialJournals).values(input).returning();
  if (!journal) throw new Error("Journal was not committed.");
  return journal;
}

export async function memberAccounts(tx: FinanceTransaction, ownerId: string) {
  await tx.insert(financialAccounts).values(["available", "pending", "reserved"].map(kind => ({ ownerId, kind, currency: financialPolicy.asset })))
    .onConflictDoNothing();
  const accounts = await tx.select().from(financialAccounts).where(eq(financialAccounts.ownerId, ownerId)).orderBy(financialAccounts.id);
  if (accounts.some(account => account.currency !== financialPolicy.asset)) throw new Error("Financial currency migration required.");
  return accounts;
}

export async function accountBalance(tx: FinanceTransaction, accountId: string) {
  const [row] = await tx.select({ balance: sql<string>`coalesce(sum(case when ${financialJournals.creditAccountId} = ${accountId} then ${financialJournals.amountAtoms} else -${financialJournals.amountAtoms} end), 0)::text` })
    .from(financialJournals).where(sql`${financialJournals.creditAccountId} = ${accountId} or ${financialJournals.debitAccountId} = ${accountId}`);
  return BigInt(row.balance);
}

export async function ownedAccount(tx: FinanceTransaction, ownerId: string, kind: "available" | "pending" | "reserved") {
  const [account] = await tx.select().from(financialAccounts).where(and(eq(financialAccounts.ownerId, ownerId), eq(financialAccounts.kind, kind))).for("update");
  if (!account) throw new Error("Financial account unavailable.");
  return account;
}
