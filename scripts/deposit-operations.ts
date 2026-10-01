import nextEnv from "@next/env";
import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

nextEnv.loadEnvConfig(process.cwd());
const { createReadDatabase } = await import("../src/db/client");
const { withTransaction } = await import("../src/db/transaction");
const { financialCommands, financialDeposits } = await import("../src/db/schema");
const { transactionActor } = await import("../src/domains/authorization");
const { assertFinancePermission } = await import("../src/domains/finance/policy");
const { financialEvent } = await import("../src/domains/finance/flow-support");
const { recoverDepositNotification } = await import("../src/domains/finance/deposit-recovery");
const { financialServicingEnabled } = await import("../src/domains/finance/gate");

// Local, privileged operator tool, not a public endpoint. The operator must
// have deployment access AND an explicit application reconciliation role.
const [operation, actorId, commandId, paymentId] = process.argv.slice(2);
if (!actorId || !["review", "recover"].includes(operation)) throw new Error("Usage: finance:deposits review <operator-user-id> | recover <operator-user-id> <command-uuid> <provider-payment-id>");
await withTransaction(async tx => {
  const actor = await transactionActor(tx, actorId);
  assertFinancePermission(actor.permissions, "finance.reconcile");
});
if (operation === "review") {
  const rows = await createReadDatabase().select({ id: financialCommands.id, providerId: financialCommands.providerId,
    state: financialCommands.state, status: financialDeposits.status, createdAt: financialCommands.createdAt,
  }).from(financialCommands).leftJoin(financialDeposits, eq(financialDeposits.commandId, financialCommands.id))
    .where(and(eq(financialCommands.kind, "deposit"), or(eq(financialCommands.state, "outcome_unknown"),
      inArray(financialDeposits.status, ["manual_review", "partial_payment", "overpayment", "late_payment", "wrong_asset_or_network", "failed_payment"]))))
    .orderBy(financialCommands.createdAt).limit(100);
  console.log(JSON.stringify({ executionEnabled: financialServicingEnabled, items: rows }, null, 2));
} else {
  if (!financialServicingEnabled) throw new Error("Deposit processing is not activated. Recovery cannot bypass acceptance.");
  const id = z.uuid().parse(commandId);
  const providerId = z.string().regex(/^\d{1,40}$/).parse(paymentId);
  await withTransaction(async tx => {
    const actor = await transactionActor(tx, actorId);
    assertFinancePermission(actor.permissions, "finance.reconcile");
    const [command] = await tx.select().from(financialCommands).where(and(eq(financialCommands.id, id), eq(financialCommands.kind, "deposit")));
    if (!command) throw new Error("Deposit command unavailable.");
    await financialEvent(tx, { memberId: command.ownerId, actorId, eventKey: `deposit:${id}:recovery:${providerId}`,
      kind: "reconciliation", resourceId: id, message: "A reconciliation operator requested authoritative deposit recovery." });
  });
  // Never POSTs to the provider or manually posts a journal. Correlation and
  // settlement must pass the same server lookup path as authenticated IPNs.
  await recoverDepositNotification({ order_id: id, payment_id: providerId });
  const { depositView } = await import("../src/domains/finance/deposit-view");
  const [command] = await createReadDatabase().select().from(financialCommands).where(eq(financialCommands.id, id));
  const view = command ? await depositView(id, command.ownerId) : null;
  console.log(JSON.stringify({ commandId: id, status: view?.status ?? "unavailable" }));
}
