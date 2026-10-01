import { communityNotice } from "@/components/access-notice";
import { requireMember } from "@/lib/session";
import { WalletOverview } from "@/components/wallet-overview";
import { newDepositsEnabled } from "@/domains/finance/gate";
import { walletView } from "@/domains/finance/wallet-view";
import Link from "next/link";

export default async function WalletPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const { user } = await requireMember();
  const wallet = await walletView(user.id);
  if (!wallet) return <WalletOverview />;
  return <div className="site-container max-w-4xl space-y-6 py-8">
    <h1 className="text-display-sm">Wallet</h1>
    {wallet.frozen && <p role="status">Spending and protected delivery are paused for financial review. Your committed balances remain recorded.</p>}
    <p>Balances are USDT, not US dollars. Pending balances are seller proceeds during the 24-hour hold; unconfirmed deposits are not spendable.</p>
    <dl className="surface grid gap-5 p-6 sm:grid-cols-3">
      <div><dt>Available</dt><dd>{wallet.available} USDT</dd></div>
      <div><dt>Pending</dt><dd>{wallet.pending} USDT</dd></div>
      <div><dt>Reserved</dt><dd>{wallet.reserved} USDT</dd></div>
    </dl>
    <nav aria-label="Wallet actions" className="flex flex-wrap gap-5">
      {newDepositsEnabled ? <Link href="/account/wallet/top-up" className="underline underline-offset-4">Top Up</Link> : <span>New deposits are paused.</span>}
      <span>External cash-out is unavailable, including seller withdrawals.</span>
      <a href="#wallet-transactions" className="underline underline-offset-4">Transactions</a>
    </nav>
    <section className="surface space-y-3 p-6" aria-labelledby="wallet-deposits">
      <h2 id="wallet-deposits" className="text-heading-lg">Recent deposit requests</h2>
      {!wallet.deposits.length ? <p>No deposit requests yet.</p> : <ul className="space-y-3">{wallet.deposits.map(deposit => <li key={deposit.id}>
        <Link className="underline underline-offset-4" href={`/account/wallet/deposits/${deposit.id}`}>{deposit.status.replaceAll("_", " ")} — {deposit.createdAt}</Link>
        {deposit.credited !== null && <span> · +{deposit.credited} USDT</span>}
      </li>)}</ul>}
    </section>
    <section id="wallet-transactions" className="surface space-y-3 p-6" aria-labelledby="wallet-activity">
      <h2 id="wallet-activity" className="text-heading-lg">Recent committed transfers</h2>
      {!wallet.journals.length ? <p>No committed transfers yet.</p> : <ul className="space-y-3">{wallet.journals.map(entry => <li key={entry.id}>
        <p>{entry.kind} · {entry.direction === "internal" ? `${entry.from} → ${entry.to}: ` : entry.direction === "credit" ? "+" : "−"}{entry.amount} USDT</p>
        <time dateTime={entry.createdAt} className="text-body-sm text-text-muted">{entry.createdAt}</time>
      </li>)}</ul>}
      <h3 className="text-heading-md">Recent status updates</h3>
      {!wallet.activity.length ? <p>No financial activity yet.</p> : <ul className="space-y-3">{wallet.activity.map(event => <li key={event.id}>
        <p>{event.message}</p><time dateTime={event.createdAt} className="text-body-sm text-text-muted">{event.createdAt}</time>
      </li>)}</ul>}
    </section>
  </div>;
}
