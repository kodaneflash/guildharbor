import "server-only";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { conversationMembers, deals, dealEvents, domainAuditEvents, messages, supportCases, supportEvents } from "@/db/schema";
import { requireMember, requireSession } from "@/lib/session";
import { transactionActor } from "@/domains/authorization";
import { notifyMember } from "@/domains/notifications/events";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function createCase(input: unknown) {
  const data = z.object({ subject: z.string().trim().min(5).max(160), body: z.string().trim().min(20).max(10000), dealId: z.uuid().optional(), conversationId: z.uuid().optional() }).parse(input);
  const session = await requireSession(); await enforceRateLimit("report", session.user.id);
  return withTransaction(async tx => {
    // Restricted accounts may request account help, but cannot attach new private resources.
    let conversationId = data.conversationId;
    if (data.dealId || data.conversationId) {
      await transactionActor(tx, session.user.id);
      if (data.dealId) {
        const [deal] = await tx.select().from(deals).where(eq(deals.id, data.dealId)).for("share");
        if (!deal || (deal.creatorId !== session.user.id && (deal.respondentId !== session.user.id || deal.state === "DRAFT"))) throw new Error("FORBIDDEN");
        conversationId = deal.conversationId ?? undefined;
      }
      if (conversationId) {
        const [member] = await tx.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, session.user.id)));
        if (!member) throw new Error("FORBIDDEN");
      }
    }
    const [record] = await tx.insert(supportCases).values({ creatorId: session.user.id, subject: data.subject, dealId: data.dealId, conversationId }).returning();
    await tx.insert(supportEvents).values({ caseId: record.id, actorId: session.user.id, kind: "opened", body: data.body });
    return record.id;
  });
}
export async function caseDetails(id: string, page = 1) {
  const session = await requireSession(); if (!z.uuid().safeParse(id).success) return null;
  const database = createReadDatabase();
  const [record] = await database.select().from(supportCases).where(and(eq(supportCases.id, id), or(eq(supportCases.creatorId, session.user.id), eq(supportCases.assignedToId, session.user.id))));
  if (!record) return null;
  if (record.assignedToId === session.user.id && record.creatorId !== session.user.id) {
    const access = await requireMember(); if (!access.permissions.some(permission => ["support.manage", "admin.manage"].includes(permission))) throw new Error("FORBIDDEN");
  }
  const events = await database.select().from(supportEvents).where(eq(supportEvents.caseId, id)).orderBy(desc(supportEvents.createdAt), desc(supportEvents.id)).limit(51).offset((page - 1) * 50);
  return { record, events: events.slice(0, 50).reverse(), hasOlder: events.length > 50, staff: record.assignedToId === session.user.id && record.creatorId !== session.user.id };
}
export async function updateCase(input: unknown) {
  const data = z.object({ id: z.uuid(), body: z.string().trim().min(5).max(10000), action: z.enum(["reply", "resolve", "close", "reopen", "cancel_deal"]) }).parse(input);
  const session = await requireSession();
  await enforceRateLimit("report", session.user.id);
  await withTransaction(async tx => {
    const [record] = await tx.select().from(supportCases).where(eq(supportCases.id, data.id)).for("update");
    if (!record || (record.creatorId !== session.user.id && record.assignedToId !== session.user.id)) throw new Error("FORBIDDEN");
    const staff = record.assignedToId === session.user.id && record.creatorId !== session.user.id;
    if (staff) { const actor = await transactionActor(tx, session.user.id); if (!actor.permissions.some(permission => ["admin.manage", "support.manage"].includes(permission))) throw new Error("FORBIDDEN"); }
    if (["resolve", "cancel_deal"].includes(data.action) && !staff) throw new Error("FORBIDDEN");
    if (data.action === "cancel_deal") {
      if (!record.dealId) throw new Error("No linked agreement");
      const [deal] = await tx.select().from(deals).where(eq(deals.id, record.dealId)).for("update");
      if (!deal || !["DRAFT", "PENDING_ACCEPTANCE", "AWAITING_FUNDING"].includes(deal.state)) throw new Error("Agreement is already terminal");
      await tx.update(deals).set({ state: "CANCELLED", version: deal.version + 1, updatedAt: new Date() }).where(eq(deals.id, deal.id));
      await tx.insert(dealEvents).values({ dealId: deal.id, actorId: session.user.id, operationId: crypto.randomUUID(), requestVersion: deal.version, action: "support_cancel", resultingState: "CANCELLED" });
      await tx.insert(domainAuditEvents).values({ actorId: session.user.id, resourceType: "deal", resourceId: deal.id, action: "deal.case_cancel", reason: data.body, metadata: { caseId: record.id } });
      for (const userId of [deal.creatorId, deal.respondentId]) if (userId) await notifyMember(tx, { userId, actorId: session.user.id, type: "deal.updated", resourceType: "deal", resourceId: deal.id, eventKey: `case-cancel:${deal.id}:${deal.version}:${userId}`, title: "Unfunded agreement cancelled by support", href: `/deals/${deal.id}` });
    }
    const status = data.action === "resolve" ? "resolved" : data.action === "close" ? "closed" : data.action === "reopen" ? "open" : record.status;
    await tx.update(supportCases).set({ status, updatedAt: new Date() }).where(eq(supportCases.id, record.id));
    await tx.insert(supportEvents).values({ caseId: record.id, actorId: session.user.id, kind: data.action, body: data.body });
    await tx.insert(domainAuditEvents).values({ actorId: session.user.id, resourceType: "support", resourceId: record.id, action: `support.${data.action}`, reason: data.body });
    const recipient = staff ? record.creatorId : record.assignedToId;
    if (recipient) await notifyMember(tx, { userId: recipient, actorId: session.user.id, type: "support.updated", resourceType: "support", resourceId: record.id, eventKey: `support:${crypto.randomUUID()}`, title: "Support case updated", href: `/support/cases/${record.id}` });
  });
}
export async function claimCase(id: string) {
  z.uuid().parse(id); const access = await requireMember();
  await withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.some(permission => ["support.manage", "admin.manage"].includes(permission))) throw new Error("FORBIDDEN");
    const [record] = await tx.select().from(supportCases).where(eq(supportCases.id, id)).for("update");
    if (!record || record.creatorId === access.user.id || (record.assignedToId && record.assignedToId !== access.user.id)) throw new Error("Case cannot be assigned to you");
    await tx.update(supportCases).set({ assignedToId: access.user.id, status: "in_review", updatedAt: new Date() }).where(eq(supportCases.id, id));
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "support", resourceId: id, action: "support.assign", reason: "Staff claimed case" });
  });
}
export async function caseEvidence(id: string) {
  const details = await caseDetails(id); if (!details?.staff) throw new Error("FORBIDDEN");
  const access = await requireMember();
  return withTransaction(async tx => {
    const actor = await transactionActor(tx, access.user.id); if (!actor.permissions.some(permission => ["support.manage", "admin.manage"].includes(permission))) throw new Error("FORBIDDEN");
    const [record] = await tx.select().from(supportCases).where(and(eq(supportCases.id, id), eq(supportCases.assignedToId, access.user.id))).for("share");
    if (!record) throw new Error("FORBIDDEN");
    await tx.insert(domainAuditEvents).values({ actorId: access.user.id, resourceType: "support", resourceId: id, action: "support.evidence_read", reason: "Assigned staff reviewed linked conversation evidence" });
    return record.conversationId ? tx.select({ id: messages.id, text: messages.plainText, createdAt: messages.createdAt }).from(messages).where(eq(messages.conversationId, record.conversationId)).orderBy(desc(messages.id)).limit(100) : [];
  });
}
