import "server-only";
import { createHash } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { financialCommands, financialDepositRequests, financialDeposits } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { claimCommand, identifyCommand, prepareCommand, retainEvidence } from "./commands";
import { nowPaymentsDepositConfig } from "./config";
import { createDirectDeposit, estimateDepositPayin, depositCapability, depositRequestSchema, instructionsSchema } from "./deposit-provider";
import { financialEvent, financialNow, lockFinanceMembers } from "./flow-support";
import { approvedDepositAsset } from "./assets";
import { parseAssetAmount, parseUsdt } from "./money";
import { newDepositsEnabled } from "./gate";
import type { FinanceTransaction } from "./database";
import { observeDeposit } from "./deposit-observation";
import { financialPolicy } from "./policy";

export class DepositUnavailable extends Error {
  constructor(message: string, readonly safeToChange = false) { super(message); }
}
export class DepositRateLimited extends DepositUnavailable {
  constructor() { super("Too many new deposit requests. Please wait up to 10 minutes before trying again.", true); }
}
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
export async function persistDepositInstructions(tx: FinanceTransaction, commandId: string, ownerId: string, payload: unknown) {
  const parsed = instructionsSchema.safeParse(payload);
  if (!parsed.success) throw new DepositUnavailable("Provider instructions could not be verified. The recorded request requires recovery; do not create another payment.");
  const data = parsed.data;
  const [intent] = await tx.select().from(financialDepositRequests).where(eq(financialDepositRequests.commandId, commandId));
  const [existing] = await tx.select().from(financialDeposits).where(eq(financialDeposits.commandId, commandId));
  if (existing) return;
  const now = await financialNow(tx);
  const expiry = data.valid_until ?? data.expiration_estimate_date;
  const amount = intent ? parseAssetAmount(data.pay_amount, intent.decimals) : 0n;
  const net = data.amount_received == null ? null : parseUsdt(data.amount_received);
  if (!intent || data.order_id !== commandId || data.pay_currency !== intent.currency ||
    intent.settlementCurrency !== financialPolicy.providerTicker ||
    data.outcome_currency !== (intent.settlementCurrency ?? intent.currency) ||
    parseAssetAmount(data.price_amount, 2) !== parseAssetAmount(intent.priceUsd, 2) ||
    intent.network === "eth" && !/^0x[a-fA-F0-9]{40}$/.test(data.pay_address) ||
    data.network !== intent.network || data.network_precision !== String(intent.decimals) ||
    (data.smart_contract || null)?.toLowerCase() !== intent.tokenContract?.toLowerCase() ||
    intent.memoRequired && !data.payin_extra_id || !expiry ||
    amount < intent.minimumAtoms || net !== null && (net <= 0n || intent.currency === (intent.settlementCurrency ?? intent.currency) && net > amount)) {
    throw new DepositUnavailable("Provider instructions require reconciliation review.");
  }
  await identifyCommand(tx, commandId, data.payment_id);
  await tx.insert(financialDeposits).values({ commandId, currency: intent.currency, settlementCurrency: (intent.settlementCurrency ?? intent.currency),
    asset: intent.asset, network: intent.network, decimals: intent.decimals, address: data.pay_address,
    memo: data.payin_extra_id ?? null, requestedAtoms: amount, minimumAtoms: intent.minimumAtoms,
    estimatedNetAtoms: net, priceUsd: intent.priceUsd, expiresAt: new Date(expiry),
    status: data.payment_status !== "waiting" ? "manual_review" : new Date(expiry) <= now ? "expired" : "awaiting_payment" });
  await financialEvent(tx, { memberId: ownerId, actorId: ownerId, eventKey: `deposit:${commandId}:created`, kind: "deposit", resourceId: commandId,
    message: net === null ? "Deposit instructions created. Provider net and fee estimates are unavailable; only final settled USDT will be credited." : "Deposit instructions created. No funds have been credited." });
}

export async function createDeposit(ownerId: string, untrusted: unknown) {
  if (!newDepositsEnabled) throw new DepositUnavailable("Deposits are not activated.");
  const input = depositRequestSchema.parse(untrusted);
  const config = nowPaymentsDepositConfig();
  const asset = approvedDepositAsset(input.currency);
  const requestDigest = hash(JSON.stringify(input));
  const command = await withTransaction(async tx => {
    await lockFinanceMembers(tx, [ownerId]);
    const existing = await tx.select().from(financialCommands).where(and(eq(financialCommands.ownerId, ownerId), eq(financialCommands.requestId, input.requestId)));
    if (existing.some(row => row.kind !== "deposit" || row.requestDigest !== requestDigest)) {
      throw new DepositUnavailable("This request already belongs to different instructions. Recover the original request from your wallet.");
    }
    if (!existing.length) {
      const unresolved = await tx.select({ id: financialCommands.id }).from(financialCommands).where(and(
        eq(financialCommands.ownerId, ownerId), eq(financialCommands.kind, "deposit"), eq(financialCommands.state, "outcome_unknown"))).limit(1);
      if (unresolved.length) throw new DepositUnavailable("An earlier deposit request needs recovery. Check your wallet before creating another.");
      // The existing member lock serializes this check with insertion, including
      // requests from other tabs/servers. Retries keep their original identity
      // and do not consume another slot or block recovery of a submitted payment.
      const now = await financialNow(tx);
      const recent = await tx.select({ id: financialCommands.id }).from(financialCommands).where(and(
        eq(financialCommands.ownerId, ownerId), eq(financialCommands.kind, "deposit"),
        gte(financialCommands.createdAt, new Date(now.getTime() - 600_000)),
      )).limit(5);
      if (recent.length >= 5) throw new DepositRateLimited();
    }
    return prepareCommand(tx, { ownerId, requestId: input.requestId, kind: "deposit", requestDigest });
  });
  if (command.state !== "prepared") return { id: command.id };
  // Capability reads can retry; the external mutation below cannot.
  const minimumAtoms = await depositCapability(config.apiKey, input.currency, config.ticker);
  const payin = await estimateDepositPayin(config.apiKey, input.currency, input.priceUsd);
  if (payin < minimumAtoms) throw new DepositUnavailable("The selected amount is below the provider minimum. Increase the USD reference amount.", true);
  const claimed = await withTransaction(async tx => {
    await lockFinanceMembers(tx, [ownerId]);
    // Another browser tab may have prepared a request while capability reads
    // were in flight. Serialize the final submission decision under this lock.
    const outstanding = await tx.select({ id: financialCommands.id }).from(financialCommands).where(and(
      eq(financialCommands.ownerId, ownerId), eq(financialCommands.kind, "deposit"), eq(financialCommands.state, "outcome_unknown")));
    if (outstanding.some(row => row.id !== command.id)) throw new DepositUnavailable("Another deposit request needs recovery before this request can be submitted.");
    const claimed = await claimCommand(tx, command.id);
    if (claimed) await tx.insert(financialDepositRequests).values({ commandId: command.id, priceUsd: input.priceUsd, currency: input.currency, settlementCurrency: config.ticker, asset: asset.asset, network: asset.network, decimals: asset.decimals,
      tokenContract: asset.tokenContract, memoRequired: asset.memoRequired, minimumAtoms });
    return claimed;
  });
  if (!claimed) return { id: command.id };
  // Even a transport failure leaves a durable outcome_unknown command. Never retry POST.
  const response = await createDirectDeposit({ ...config, ticker: input.currency, commandId: command.id, priceUsd: input.priceUsd });
  await withTransaction(tx => retainEvidence(tx, { commandId: command.id, source: "command", digest: hash(response.raw), body: response.raw,
    keyHex: config.keyHex, keyVersion: config.keyVersion }));
  await withTransaction(async tx => {
    await lockFinanceMembers(tx, [ownerId], false);
    await persistDepositInstructions(tx, command.id, ownerId, response.data);
  });
  await observeDeposit(command.id, ownerId);
  return { id: command.id };
}

export const depositReferenceSchema = z.object({ payment_id: z.string().regex(/^\d{1,40}$/), order_id: z.uuid() });

/** Recovery may identify a final payment without a creation-shaped quote.
 * Preserve it for review; missing instructions never authorize sending or credit. */
export async function persistRecoveredDeposit(tx: FinanceTransaction, commandId: string, ownerId: string, payload: unknown) {
  if (instructionsSchema.safeParse(payload).success) return persistDepositInstructions(tx, commandId, ownerId, payload);
  const data = z.object({ payment_id: z.string().regex(/^\d{1,40}$/), order_id: z.uuid(),
    price_amount: z.string(), price_currency: z.literal("usd"), pay_currency: z.string(),
    pay_address: z.string().min(1).max(250), pay_amount: z.string(), payin_extra_id: z.string().max(250).nullish(),
  }).parse(payload);
  const [intent] = await tx.select().from(financialDepositRequests).where(eq(financialDepositRequests.commandId, commandId));
  if (!intent || data.order_id !== commandId || data.pay_currency !== intent.currency ||
    intent.settlementCurrency !== financialPolicy.providerTicker ||
    parseAssetAmount(data.price_amount, 2) !== parseAssetAmount(intent.priceUsd, 2)) throw new Error("Recovered payment does not match the deposit request.");
  const amount = parseAssetAmount(data.pay_amount, intent.decimals);
  if (amount <= 0n) throw new Error("Recovered payment amount unavailable.");
  await identifyCommand(tx, commandId, data.payment_id);
  await tx.insert(financialDeposits).values({ commandId, currency: intent.currency, settlementCurrency: (intent.settlementCurrency ?? intent.currency),
    asset: intent.asset, network: intent.network, decimals: intent.decimals,
    address: data.pay_address, memo: data.payin_extra_id ?? null, requestedAtoms: amount,
    minimumAtoms: intent.minimumAtoms, priceUsd: intent.priceUsd, expiresAt: intent.createdAt, status: "manual_review",
  }).onConflictDoNothing();
  await financialEvent(tx, { memberId: ownerId, actorId: ownerId, eventKey: `deposit:${commandId}:recovered-review`,
    kind: "manual_review", resourceId: commandId, message: "Payment identified; incomplete original instructions require reconciliation review. Do not pay again." });
}
