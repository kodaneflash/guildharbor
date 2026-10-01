import { communityNotice } from "@/components/access-notice";
import Link from "next/link";
import { requireMember } from "@/lib/session";
import { newDepositsEnabled } from "@/domains/finance/gate";
import { approvedDepositAssets } from "@/domains/finance/assets";
import { DepositForm } from "@/components/deposit-form";

export default async function TopUpPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  await requireMember();
  return <div className="site-container max-w-2xl space-y-5 py-8">
    <h1 className="text-display-sm">Top up your wallet</h1>
    {newDepositsEnabled ? <DepositForm assets={approvedDepositAssets().map(({ ticker, asset, network }) => ({ ticker, asset, network }))} /> : <p>Deposits are not activated. No payment address can be issued until provider and security acceptance checks pass.</p>}
    <Link href="/account/wallet" className="underline underline-offset-4">Back to wallet</Link>
  </div>;
}
