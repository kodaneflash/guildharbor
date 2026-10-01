import "server-only";
import { and, eq } from "drizzle-orm";
import { createReadDatabase } from "@/db/client";
import { financialCommands, financialDeposits } from "@/db/schema";
import { formatAssetAmount, formatUsdt } from "./money";

export async function depositView(commandId: string, ownerId: string) {
  const [row] = await createReadDatabase().select({ command: financialCommands, deposit: financialDeposits }).from(financialCommands)
    .leftJoin(financialDeposits, eq(financialDeposits.commandId, financialCommands.id))
    .where(and(eq(financialCommands.id, commandId), eq(financialCommands.ownerId, ownerId), eq(financialCommands.kind, "deposit")));
  if (!row) return null;
  const deposit = row.deposit;
  if (!deposit) return { id: commandId, status: row.command.state === "prepared" ? "preparing" : "outcome_unknown", instructions: null };
  const expired = deposit.expiresAt <= new Date();
  return { id: commandId, status: deposit.status === "awaiting_payment" && expired ? "expired" : deposit.status,
    creditedAmount: deposit.settledAtoms === null ? null : formatUsdt(deposit.settledAtoms),
    updatedAt: deposit.updatedAt.toISOString(),
    instructions: deposit.status === "awaiting_payment" && !expired && deposit.minimumAtoms !== null ? {
      asset: deposit.asset, network: deposit.network, amount: formatAssetAmount(deposit.requestedAtoms, deposit.decimals),
      address: deposit.address, memo: deposit.memo, priceUsd: deposit.priceUsd,
      minimum: formatAssetAmount(deposit.minimumAtoms, deposit.decimals),
      estimatedNet: deposit.estimatedNetAtoms === null ? null : formatUsdt(deposit.estimatedNetAtoms),
      estimatedFee: deposit.estimatedNetAtoms === null || deposit.currency !== (deposit.settlementCurrency ?? deposit.currency) ? null : formatUsdt(deposit.requestedAtoms - deposit.estimatedNetAtoms), expiresAt: deposit.expiresAt.toISOString(),
    } : null,
  };
}
