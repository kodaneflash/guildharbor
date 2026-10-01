import "server-only";
import { inArray, isNull, or, sql } from "drizzle-orm";
import { financialAccounts, financialActivity, financialFreezes, notifications, users } from "@/db/schema";
import { hasCommunityAccess } from "@/lib/community-access";
import type { FinanceTransaction } from "./database";
import { memberAccounts } from "./ledger";
import { z } from "zod";
import { financialPolicy } from "./policy";

export async function lockFinanceMembers(tx: FinanceTransaction, ids: string[], requireEligible = true) {
  const unique = [...new Set(ids)].sort();
  if (!unique.length) throw new Error("Financial operation requires an owner.");
  const members = await tx.select().from(users).where(inArray(users.id, unique)).orderBy(users.id).for("update");
  if (members.length !== unique.length || requireEligible && members.some(member => !hasCommunityAccess(member))) throw new Error("FORBIDDEN");
  if (requireEligible) {
    const frozen = await tx.select().from(financialFreezes).where(inArray(financialFreezes.memberId, unique));
    if (frozen.length) throw new Error("Financial account requires review.");
  }
  for (const id of unique) await memberAccounts(tx, id);
  return members;
}

export async function lockFinanceAccounts(tx: FinanceTransaction, memberIds: string[]) {
  await tx.insert(financialAccounts).values([{ kind: "backing", currency: financialPolicy.asset }, { kind: "platform_revenue", currency: financialPolicy.asset }]).onConflictDoNothing();
  const accounts = await tx.select().from(financialAccounts)
    .where(or(inArray(financialAccounts.ownerId, memberIds), isNull(financialAccounts.ownerId)))
    .orderBy(financialAccounts.id).for("update");
  if (accounts.some(account => account.currency !== financialPolicy.asset)) throw new Error("Financial currency migration required.");
  return {
    member(ownerId: string, kind: "available" | "pending" | "reserved") {
      if (!memberIds.includes(ownerId)) throw new Error("Account outside transaction participants.");
      const account = accounts.find(row => row.ownerId === ownerId && row.kind === kind);
      if (!account) throw new Error("Financial account unavailable.");
      return account.id;
    },
    system(kind: "backing" | "platform_revenue") {
      const account = accounts.find(row => row.ownerId === null && row.kind === kind);
      if (!account) throw new Error("Financial account unavailable.");
      return account.id;
    },
  };
}

export async function financialEvent(tx: FinanceTransaction, input: {
  memberId: string; actorId: string; eventKey: string; kind: string; resourceId: string; message: string;
}) {
  const [event] = await tx.insert(financialActivity).values(input).onConflictDoNothing({ target: financialActivity.eventKey }).returning();
  if (event) await tx.insert(notifications).values({
    userId: input.memberId, actorId: input.actorId, eventKey: `finance:${input.eventKey}`,
    type: "wallet.updated", resourceType: "wallet", resourceId: input.memberId,
    title: input.message, href: "/account/wallet",
  }).onConflictDoNothing({ target: notifications.eventKey });
}

export async function freezeFinancialMember(tx: FinanceTransaction, memberId: string, reason: string) {
  await tx.insert(financialFreezes).values({ memberId, reason }).onConflictDoNothing();
  await financialEvent(tx, { memberId, actorId: memberId, eventKey: `freeze:${memberId}:${reason}`, kind: "manual_review", resourceId: memberId, message: "Financial activity paused for reconciliation review." });
}

export async function financialNow(tx: FinanceTransaction): Promise<Date> {
  const result = z.object({ rows: z.array(z.object({ current_time: z.string() })).min(1) }).parse(await tx.execute(sql`select clock_timestamp()::text as current_time`));
  const row = result.rows[0];
  const time = new Date(row.current_time);
  if (!Number.isFinite(time.getTime())) throw new Error("Invalid database clock.");
  return time;
}
