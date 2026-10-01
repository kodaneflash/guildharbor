import { communityNotice } from "@/components/access-notice";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMember } from "@/lib/session";
import { financialServicingEnabled } from "@/domains/finance/gate";
import { depositView } from "@/domains/finance/deposit-view";
import { DepositProgress } from "@/components/deposit-progress";

export default async function DepositPage({ params }: { params: Promise<{ commandId: string }> }) {
  const notice = await communityNotice();
  if (notice) return notice;
  const { user } = await requireMember();
  if (!financialServicingEnabled) return <div className="site-container py-8">Deposits are not activated.</div>;
  const id = z.uuid().safeParse((await params).commandId);
  if (!id.success) notFound();
  const view = await depositView(id.data, user.id);
  if (!view) notFound();
  return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm">Wallet deposit</h1><DepositProgress key={view.id} initial={view} /></div>;
}
