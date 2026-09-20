import "server-only";
import { and, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { conversations, conversationMembers, dealAcceptances, dealEvents, deals, dealTerms, domainAuditEvents, users } from "@/db/schema";
import { transactionActor } from "@/domains/authorization";
import { notifyMember } from "@/domains/notifications/events";
import { usdPrice } from "@/domains/commerce/validation";
import { requireMember } from "@/lib/session";
import { hasCommunityAccess } from "@/lib/community-access";
import { enforceRateLimit } from "@/lib/rate-limit";
export const draftSchema = z.object({ id: z.uuid().optional(), version: z.coerce.number().int().positive().optional(), name: z.string().trim().min(3).max(160), respondent: z.string().trim().min(3).max(30), payer: z.enum(["creator", "respondent"]), amount: usdPrice, terms: z.string().trim().min(20).max(20000) });
export async function saveDealDraft(input: unknown) {
  const access = await requireMember(); const data = draftSchema.parse(input); await enforceRateLimit("thread", access.user.id);
  return withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    const [respondent] = await tx.select().from(users).where(eq(users.username, data.respondent.toLowerCase())).for("share");
    if (!respondent || !hasCommunityAccess(respondent) || respondent.id === access.user.id) return { error: "Choose a different eligible member as respondent." };
    const [current] = data.id ? await tx.select().from(deals).where(eq(deals.id, data.id)).for("update") : [];
    if (data.id && (!current || current.creatorId !== access.user.id)) throw new Error("FORBIDDEN");
    if (current && (current.state !== "DRAFT" || current.version !== data.version)) return { error: "Only the current unsent draft may be edited." };
    const fields = { name: data.name, respondentId: respondent.id, payerId: data.payer === "creator" ? access.user.id : respondent.id, amountCents: data.amount, terms: data.terms, version: (current?.version ?? 0) + 1, updatedAt: new Date() };
    const [deal] = current ? await tx.update(deals).set(fields).where(eq(deals.id, current.id)).returning() : await tx.insert(deals).values({ ...fields, creatorId: access.user.id }).returning();
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "deal", resourceId: deal.id, action: "deal.draft", reason: "Draft saved", metadata: { version: deal.version } });
    return { id: deal.id };
  });
}
export async function transitionDeal(input: unknown) {
  const data = z.object({ id: z.uuid(), operationId: z.uuid(), version: z.coerce.number().int().positive(), action: z.enum(["invite", "accept", "decline", "cancel"]) }).parse(input);
  const access = await requireMember();
  return withTransaction(async tx => {
    await transactionActor(tx, access.user.id);
    const [deal] = await tx.select().from(deals).where(eq(deals.id, data.id)).for("update");
    if (!deal || (deal.creatorId !== access.user.id && (deal.respondentId !== access.user.id || deal.state === "DRAFT"))) throw new Error("FORBIDDEN");
    const [existing] = await tx.select().from(dealEvents).where(and(eq(dealEvents.actorId, access.user.id), eq(dealEvents.operationId, data.operationId)));
    if (existing) { if (existing.dealId !== data.id || existing.action !== data.action || existing.requestVersion !== data.version) throw new Error("Operation ID reused for different input"); return { state: existing.resultingState }; }
    if (deal.version !== data.version) return { error: "The agreement changed. Reload before acting." };
    let state: string;
    if (data.action === "invite" && deal.state === "DRAFT" && deal.creatorId === access.user.id) {
      if (!deal.respondentId || !deal.payerId) throw new Error("Incomplete draft");
      await transactionActor(tx, deal.respondentId);
      const [conversation] = await tx.insert(conversations).values({ type: "deal" }).returning({ id: conversations.id });
      await tx.insert(conversationMembers).values([{ conversationId: conversation.id, userId: deal.creatorId }, { conversationId: conversation.id, userId: deal.respondentId }]);
      await tx.insert(dealTerms).values({ dealId: deal.id, version: deal.version, name: deal.name, terms: deal.terms, amountCents: deal.amountCents, payerId: deal.payerId, creatorId: deal.creatorId, respondentId: deal.respondentId });
      await tx.insert(dealAcceptances).values({ dealId: deal.id, userId: deal.creatorId, termsVersion: deal.version });
      await tx.update(deals).set({ conversationId: conversation.id }).where(eq(deals.id, deal.id)); state = "PENDING_ACCEPTANCE";
    } else if (data.action === "accept" && deal.state === "PENDING_ACCEPTANCE" && deal.respondentId === access.user.id) {
      await transactionActor(tx, deal.creatorId);
      const [terms] = await tx.select().from(dealTerms).where(eq(dealTerms.dealId, deal.id)); if (!terms) throw new Error("Agreement snapshot missing");
      await tx.insert(dealAcceptances).values({ dealId: deal.id, userId: access.user.id, termsVersion: terms.version }); state = "AWAITING_FUNDING";
    } else if (data.action === "decline" && deal.state === "PENDING_ACCEPTANCE" && deal.respondentId === access.user.id) state = "DECLINED";
    else if (data.action === "cancel" && ((["DRAFT", "PENDING_ACCEPTANCE"].includes(deal.state) && deal.creatorId === access.user.id) || deal.state === "AWAITING_FUNDING")) state = "CANCELLED";
    else if (data.action === "accept" && deal.state === "AWAITING_FUNDING" && deal.respondentId === access.user.id) return { state: deal.state };
    else return { error: "That transition is not available for this agreement." };
    await tx.update(deals).set({ state, version: deal.version + 1, updatedAt: new Date() }).where(eq(deals.id, deal.id));
    await tx.insert(dealEvents).values({ dealId: deal.id, actorId: access.user.id, operationId: data.operationId, requestVersion: data.version, action: data.action, resultingState: state });
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "deal", resourceId: deal.id, action: `deal.${data.action}`, reason: "Participant agreement transition", metadata: { state, version: deal.version } });
    const recipient = access.user.id === deal.creatorId ? deal.respondentId : deal.creatorId;
    if (recipient && (deal.state !== "DRAFT" || data.action === "invite")) await notifyMember(tx, { userId: recipient, actorId: access.user.id, type: "deal.updated", resourceType: "deal", resourceId: deal.id, eventKey: `deal:${data.operationId}:${recipient}`, title: "Agreement updated", href: `/deals/${deal.id}` });
    return { state };
  });
}
export async function findDeal(id: string) {
  const access = await requireMember(); if (!z.uuid().safeParse(id).success) return null;
  const [deal] = await createReadDatabase().select().from(deals).where(and(eq(deals.id, id), or(eq(deals.creatorId, access.user.id), and(eq(deals.respondentId, access.user.id), ne(deals.state, "DRAFT")))));
  return deal ?? null;
}
export async function listDeals(archive = false, page = 1) {
  const access = await requireMember(); const database = createReadDatabase();
  return database.select().from(deals).where(and(or(eq(deals.creatorId, access.user.id), and(eq(deals.respondentId, access.user.id), ne(deals.state, "DRAFT"))), archive ? or(eq(deals.state, "DECLINED"), eq(deals.state, "CANCELLED")) : and(ne(deals.state, "DECLINED"), ne(deals.state, "CANCELLED")))).orderBy(desc(deals.updatedAt), desc(deals.id)).limit(30).offset((page - 1) * 30);
}
