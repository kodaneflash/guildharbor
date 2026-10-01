import "server-only";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { financialCommands, financialDeposits, financialEvidence, financialIpnReceipts, financialDepositRequests } from "@/db/schema";
import { nowPaymentsDepositConfig } from "./config";
import { depositReferenceSchema, persistRecoveredDeposit } from "./deposit-creation";
import { observeDeposit } from "./deposit-observation";
import { discoverDepositPayments, readDirectDeposit } from "./deposit-provider";
import { financialEvent, freezeFinancialMember, lockFinanceMembers } from "./flow-support";
import { financialServicingEnabled } from "./gate";
import { decryptCommandEvidence, decryptRetainedEvidence, retainEvidence } from "./commands";
import { createHash } from "node:crypto";
import { parseProviderJson } from "./nowpayments";

/** Called by authenticated IPNs or the role-checked local recovery tool. A
 * reference selects a lookup, never proves money or overrides an identity. */
export async function recoverDepositNotification(payload: unknown) {
  if (!financialServicingEnabled) return;
  const reference = depositReferenceSchema.safeParse(payload);
  if (!reference.success) return;
  const [command] = await createReadDatabase().select().from(financialCommands).where(and(
    eq(financialCommands.id, reference.data.order_id), eq(financialCommands.kind, "deposit")));
  if (!command || command.state === "prepared") return;
  if (command.providerId && command.providerId !== reference.data.payment_id) {
    // A repeated/wrong-asset child payment must not replace the original ID.
    const config = nowPaymentsDepositConfig();
    const response = await readDirectDeposit(reference.data.payment_id, config.apiKey);
    const authoritative = depositReferenceSchema.parse(response.data);
    if (authoritative.order_id !== command.id || authoritative.payment_id !== reference.data.payment_id) throw new Error("Provider correlation mismatch.");
    await withTransaction(async tx => {
      await lockFinanceMembers(tx, [command.ownerId], false);
      await retainEvidence(tx, { commandId: command.id, source: "lookup", digest: createHash("sha256").update(response.raw).digest("hex"), body: response.raw,
        keyHex: config.keyHex, keyVersion: config.keyVersion });
      await tx.update(financialDeposits).set({ status: "manual_review", updatedAt: new Date() }).where(eq(financialDeposits.commandId, command.id));
      await freezeFinancialMember(tx, command.ownerId, `additional-payment:${command.id}`);
      await financialEvent(tx, { memberId: command.ownerId, actorId: command.ownerId, eventKey: `deposit:${command.id}:additional:${authoritative.payment_id}`,
        kind: "manual_review", resourceId: command.id, message: "An additional payment requires reconciliation review; no additional balance has been credited." });
    });
    return;
  }
  const [deposit] = await createReadDatabase().select({ id: financialDeposits.commandId }).from(financialDeposits)
    .where(eq(financialDeposits.commandId, command.id));
  if (!deposit) {
    const config = nowPaymentsDepositConfig();
    const response = await readDirectDeposit(reference.data.payment_id, config.apiKey);
    const authoritative = depositReferenceSchema.parse(response.data);
    if (authoritative.payment_id !== reference.data.payment_id || authoritative.order_id !== command.id) throw new Error("Provider correlation mismatch.");
    const [retained] = await createReadDatabase().select().from(financialEvidence).where(and(
      eq(financialEvidence.commandId, command.id), eq(financialEvidence.source, "command"))).limit(1);
    const instructions = retained ? parseProviderJson(decryptCommandEvidence(retained, config.keyHex, config.keyVersion)) : response.data;
    const instructionReference = depositReferenceSchema.parse(instructions);
    if (instructionReference.payment_id !== authoritative.payment_id || instructionReference.order_id !== command.id) throw new Error("Retained command mismatch.");
    await withTransaction(async tx => {
      await lockFinanceMembers(tx, [command.ownerId], false);
      await retainEvidence(tx, { commandId: command.id, source: "lookup", digest: createHash("sha256").update(response.raw).digest("hex"), body: response.raw,
        keyHex: config.keyHex, keyVersion: config.keyVersion });
      await persistRecoveredDeposit(tx, command.id, command.ownerId, instructions);
    });
  }
  await observeDeposit(command.id, command.ownerId);
}

/** Existing maintenance scheduler owns recovery; no second queue or worker.
 * Include expired deposits (late payments) and completed deposits (regressions).
 */
export async function recoverDeposits() {
  if (!financialServicingEnabled) return { checked: 0, failed: 0, enabled: false };
  const database = createReadDatabase();
  let checked = 0; let failed = 0;
  const config = nowPaymentsDepositConfig();
  const receipts = await database.select({ receipt: financialIpnReceipts, evidence: financialEvidence }).from(financialIpnReceipts)
    .innerJoin(financialEvidence, eq(financialEvidence.id, financialIpnReceipts.evidenceId))
    .where(and(isNull(financialIpnReceipts.processedAt), lte(financialIpnReceipts.nextCheckAt, sql`now()`)))
    .orderBy(financialIpnReceipts.nextCheckAt).limit(1);
  for (const item of receipts) {
    const claimed = await database.update(financialIpnReceipts).set({ nextCheckAt: sql`now() + interval '5 minutes'` })
      .where(and(eq(financialIpnReceipts.evidenceId, item.evidence.id), isNull(financialIpnReceipts.processedAt),
        lte(financialIpnReceipts.nextCheckAt, sql`now()`))).returning();
    if (!claimed.length) continue;
    try {
      const body = decryptRetainedEvidence(item.evidence, config.keyHex, config.keyVersion);
      await recoverDepositNotification(parseProviderJson(body));
      await database.update(financialIpnReceipts).set({ processedAt: new Date() }).where(eq(financialIpnReceipts.evidenceId, item.evidence.id));
      checked++;
    } catch { failed++; console.error("finance.deposit.receipt_failed", { evidenceId: item.evidence.id }); }
  }
  const unknown = await database.select({ command: financialCommands, submittedAt: financialDepositRequests.createdAt }).from(financialCommands)
    .innerJoin(financialDepositRequests, eq(financialDepositRequests.commandId, financialCommands.id))
    .leftJoin(financialDeposits, eq(financialDeposits.commandId, financialCommands.id))
    .where(and(eq(financialCommands.kind, "deposit"), or(eq(financialCommands.state, "outcome_unknown"),
      and(eq(financialCommands.state, "identified"), isNull(financialDeposits.commandId))),
      lte(financialCommands.nextCheckAt, sql`now()`))).orderBy(financialCommands.nextCheckAt).limit(1);
  for (const { command, submittedAt } of unknown) {
    const claimed = await database.update(financialCommands).set({ nextCheckAt: sql`now() + interval '5 minutes'` })
      .where(and(eq(financialCommands.id, command.id), lte(financialCommands.nextCheckAt, sql`now()`))).returning();
    if (!claimed.length) continue;
    try {
      const [retained] = await database.select().from(financialEvidence).where(and(eq(financialEvidence.commandId, command.id),
        eq(financialEvidence.source, "command"))).limit(1);
      if (retained) await recoverDepositNotification(parseProviderJson(decryptCommandEvidence(retained, config.keyHex, config.keyVersion)));
      else if (command.providerId) await recoverDepositNotification({ payment_id: command.providerId, order_id: command.id });
      else {
        const matches = await discoverDepositPayments(config.apiKey, command.id, submittedAt);
        if (matches.length !== 1) throw new Error("Unidentified payment requires operator recovery.");
        await recoverDepositNotification(matches[0]);
      }
      checked++;
    } catch { failed++; console.error("finance.deposit.identification_required", { commandId: command.id }); }
  }
  const due = await database.select({ id: financialDeposits.commandId, ownerId: financialCommands.ownerId }).from(financialDeposits)
    .innerJoin(financialCommands, eq(financialCommands.id, financialDeposits.commandId))
    .where(lte(financialDeposits.nextCheckAt, sql`now()`)).orderBy(financialDeposits.nextCheckAt).limit(3);
  for (const item of due) {
    // Claim a bounded retry delay; a worker crash is recovered after that delay.
    const claimed = await database.update(financialDeposits).set({ nextCheckAt: sql`now() + interval '5 minutes'` })
      .where(and(eq(financialDeposits.commandId, item.id), lte(financialDeposits.nextCheckAt, sql`now()`))).returning({ id: financialDeposits.commandId });
    if (!claimed.length) continue;
    try { await observeDeposit(item.id, item.ownerId); checked++; }
    catch { failed++; console.error("finance.deposit.lookup_failed", { commandId: item.id }); }
  }
  return { checked, failed, enabled: true };
}
