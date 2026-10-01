import "server-only";
import { createHash } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { financialCommands, financialDeposits } from "@/db/schema";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { nowPaymentsDepositConfig } from "./config";
import { retainEvidence } from "./commands";
import { classifyDeposit, paymentEvidenceSchema } from "./nowpayments";
import { financialEvent, financialNow, freezeFinancialMember, lockFinanceAccounts, lockFinanceMembers } from "./flow-support";
import { readCustodyBacking, readDirectDeposit } from "./deposit-provider";
import { accountBalance, postJournal } from "./ledger";
import { parseUsdt, formatUsdt } from "./money";
import { financialServicingEnabled } from "./gate";

/** Server-side recovery read. A callback or member request can request a lookup,
 * but cannot supply its result. Final provider status alone never issues credit.
 */
export async function observeDeposit(commandId: string, ownerId: string) {
  if (!financialServicingEnabled) throw new Error("Deposit processing is not activated.");
  const [command] = await createReadDatabase().select().from(financialCommands).where(and(
    eq(financialCommands.id, commandId), eq(financialCommands.ownerId, ownerId), eq(financialCommands.kind, "deposit"),
  ));
  if (!command?.providerId) throw new Error("Deposit is awaiting provider identification.");
  const config = nowPaymentsDepositConfig();
  const providerId = command.providerId;
  return withTransaction(async tx => {
    await lockFinanceMembers(tx, [ownerId], false);
    const [deposit] = await tx.select().from(financialDeposits).where(eq(financialDeposits.commandId, commandId)).for("update");
    if (!deposit) throw new Error("Deposit instructions unavailable.");
    // Lookup under the owner/deposit lock prevents stale concurrent responses
    // from being applied after a newer observation. No external mutations here.
    const response = await readDirectDeposit(providerId, config.apiKey);
    const body = response.raw;
    const digest = createHash("sha256").update(body).digest("hex");
    await retainEvidence(tx, { commandId, source: "lookup", digest, body, keyHex: config.keyHex, keyVersion: config.keyVersion });
    const now = await financialNow(tx);
    const parsed = paymentEvidenceSchema.safeParse(response.data);
    if (!parsed.success) {
      await tx.update(financialDeposits).set({ status: "manual_review", updatedAt: now,
        nextCheckAt: new Date(now.getTime() + 3_600_000) }).where(eq(financialDeposits.commandId, commandId));
      if (deposit.creditedJournalId) await freezeFinancialMember(tx, ownerId, `deposit-regression:${commandId}`);
      return;
    }
    const evidence = parsed.data;
    const disposition = classifyDeposit(evidence, {
      paymentId: providerId, reference: command.id, currency: deposit.currency,
      settlementCurrency: config.ticker, decimals: deposit.decimals,
      address: deposit.address, memo: deposit.memo, requestedAtoms: deposit.requestedAtoms,
      quoteExpiredBeforeDetection: !deposit.detectedAt && now >= deposit.expiresAt,
    });
    // Without prior detection evidence, a post-expiry observation cannot prove
    // timely payment. Review is safer than inventing a blockchain timestamp.
    if (deposit.creditedJournalId) {
      if (disposition !== "eligible_for_reconciliation" || parseUsdt(evidence.outcome_amount ?? "0") !== deposit.settledAtoms || evidence.payin_hash?.toLowerCase() !== deposit.payinHash) {
        await freezeFinancialMember(tx, ownerId, `deposit-regression:${commandId}`);
        await tx.update(financialDeposits).set({ status: "manual_review", updatedAt: now }).where(eq(financialDeposits.commandId, commandId));
      }
      await tx.update(financialDeposits).set({ nextCheckAt: new Date(now.getTime() + 86_400_000) }).where(eq(financialDeposits.commandId, commandId));
      return;
    }
    const exceptions = ["manual_review", "partial_payment", "overpayment", "late_payment", "wrong_asset_or_network"];
    // Review decisions must not disappear when callbacks or lookups reorder.
    let status: string = exceptions.includes(deposit.status) ? deposit.status : disposition;
    if ((deposit.status === "confirming" && ["awaiting_payment", "detected"].includes(disposition)) ||
      (deposit.status === "detected" && disposition === "awaiting_payment") ||
      (["expired", "failed_payment"].includes(deposit.status) && disposition !== deposit.status)) status = "manual_review";
    let creditedJournalId: string | undefined;
    let settledAtoms: bigint | undefined;
    let payinHash: string | undefined;
    if (status === "eligible_for_reconciliation") {
      const accounts = await lockFinanceAccounts(tx, [ownerId]);
      // The global backing account serializes credits and future treasury
      // reservations. Pending custody funds never count as spendable backing.
      const backing = await readCustodyBacking(config.apiKey, (deposit.settlementCurrency ?? deposit.currency));
      const backingDigest = createHash("sha256").update(backing.raw).digest("hex");
      await retainEvidence(tx, { commandId, source: "lookup", digest: backingDigest, body: backing.raw, keyHex: config.keyHex, keyVersion: config.keyVersion });
      const amount = parseUsdt(evidence.outcome_amount ?? "0");
      const bookBacking = -(await accountBalance(tx, accounts.system("backing")));
      const duplicate = evidence.payin_hash ? await tx.select({ id: financialDeposits.commandId }).from(financialDeposits)
        .where(and(eq(financialDeposits.payinHash, evidence.payin_hash.toLowerCase()), ne(financialDeposits.commandId, commandId))).limit(1) : [];
      if (!evidence.payin_hash || !/^[a-zA-Z0-9:_-]{1,250}$/.test(evidence.payin_hash) || duplicate.length || bookBacking < 0n || backing.atoms < bookBacking + amount) {
        status = "manual_review";
      } else {
        // Activation requires merchant confirmation that finished/outcome_amount
        // means net settlement in THIS custody asset. Balance alone is not proof.
        const journal = await postJournal(tx, { reference: `deposit:${commandId}`, kind: "deposit", actorId: ownerId,
          debitAccountId: accounts.system("backing"), creditAccountId: accounts.member(ownerId, "available"),
          amountAtoms: amount, evidenceReference: `lookup:${digest};backing:${backingDigest}` });
        creditedJournalId = journal.id; settledAtoms = amount; payinHash = evidence.payin_hash.toLowerCase(); status = "completed";
      }
    }
    const detected = evidence.actually_paid !== null && !/^0(?:\.0+)?$/.test(evidence.actually_paid);
    await tx.update(financialDeposits).set({ status, creditedJournalId, settledAtoms, payinHash, detectedAt: deposit.detectedAt ?? (detected ? now : null), updatedAt: now,
      nextCheckAt: new Date(now.getTime() + (status === "completed" ? 86_400_000 : status === "expired" || exceptions.includes(status) ? 3_600_000 : 60_000)) })
      .where(eq(financialDeposits.commandId, commandId));
    if (status !== deposit.status) await financialEvent(tx, {
      memberId: ownerId, actorId: ownerId, eventKey: `deposit:${commandId}:${digest}`, kind: "deposit", resourceId: commandId,
      message: status === "completed" && settledAtoms ? `Deposit completed: ${formatUsdt(settledAtoms)} USDT credited after fees.`
        : status === "wrong_asset_or_network" ? "A different coin or network was received. The payment is under review; no balance has been credited."
          : `Deposit status: ${status.replaceAll("_", " ")}.`,
    });
  });
}
