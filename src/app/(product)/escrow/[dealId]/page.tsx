import { randomUUID } from "node:crypto";
import { eq, inArray, asc } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findDeal } from "@/domains/deals/deal-service";
import { createReadDatabase } from "@/db/client";
import { dealAcceptances, dealEvents, users } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { DealDraftForm, DealTransitionForm } from "@/components/deal-forms";
import { formatUsd } from "@/domains/commerce/validation";
export default async function DealPage({ params }: { params: Promise<{ dealId: string }> }) {
  const deal = await findDeal((await params).dealId); if (!deal) notFound(); const access = await requireMember(); const database = createReadDatabase();
  const people = await database.select({ id: users.id, username: users.username }).from(users).where(inArray(users.id, [deal.creatorId, ...(deal.respondentId ? [deal.respondentId] : [])]));
  const name = (id: string | null) => people.find(person => person.id === id)?.username ?? "Unavailable member";
  const actions: Array<"invite" | "accept" | "decline" | "cancel"> = deal.state === "DRAFT" ? ["invite", "cancel"] : deal.state === "PENDING_ACCEPTANCE" ? access.user.id === deal.creatorId ? ["cancel"] : ["accept", "decline"] : deal.state === "AWAITING_FUNDING" ? ["cancel"] : [];
  const acceptances = await database.select().from(dealAcceptances).where(eq(dealAcceptances.dealId, deal.id));
  const events = await database.select().from(dealEvents).where(eq(dealEvents.dealId, deal.id)).orderBy(asc(dealEvents.createdAt));
  return <div className="site-container max-w-4xl space-y-5 py-8"><Link href="/escrow">Your agreements</Link><h1 className="text-display-sm font-bold">{deal.name}</h1><p>{deal.state} · {formatUsd(deal.amountCents)}</p><p>Creator: {name(deal.creatorId)} · Respondent: {name(deal.respondentId)} · Payer: {name(deal.payerId)}</p><section className="surface space-y-3 p-6"><h2 className="text-heading-lg font-bold">Agreement terms</h2><p className="whitespace-pre-wrap">{deal.terms}</p>{acceptances.map(consent => <p key={consent.userId}>{name(consent.userId)} agreed to terms version {consent.termsVersion} on {consent.createdAt.toISOString()}.</p>)}</section><p className="text-text-muted">Funding is unavailable. No funds are held and protected fulfillment is not released.</p><DealTransitionForm id={deal.id} version={deal.version} operationId={randomUUID()} actions={actions} />{deal.state === "DRAFT" && <DealDraftForm draft={{ id: deal.id, version: deal.version, name: deal.name, respondent: name(deal.respondentId), payer: deal.payerId === deal.creatorId ? "creator" : "respondent", amountCents: deal.amountCents, terms: deal.terms }} />}{deal.conversationId && <Link className="button-primary" href={`/messages/${deal.conversationId}`}>Open agreement conversation</Link>}<Link className="button-secondary" href={`/support?deal=${deal.id}`}>Request support</Link><section className="surface space-y-3 p-5"><h2 className="text-heading-lg font-bold">Agreement history</h2>{events.map(event => <p key={event.id}>{event.action} → {event.resultingState} · {event.createdAt.toISOString()}</p>)}</section></div>;
}
