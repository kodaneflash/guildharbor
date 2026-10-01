import Link from "next/link";
import { ArrowDown, ArrowUp, List, Plus } from "lucide-react";

/** Pre-activation view: no fabricated balances or provider deposit instructions. */
export function WalletOverview() {
  return <div className="site-container max-w-5xl space-y-6 py-8">
    <header className="space-y-2">
      <p className="text-body-sm text-text-muted">USDT · Ethereum network</p>
      <h1 className="text-display-sm">Wallet</h1>
      <p id="wallet-disabled" className="text-text-muted">Not activated. Deposits and paid purchases remain disabled until security, reconciliation and merchant-account checks pass. External cash-out is unavailable.</p>
    </header>
    <section aria-labelledby="wallet-balances" className="surface space-y-6 p-6 sm:p-8">
      <div className="space-y-3 text-center">
        <h2 id="wallet-balances" className="text-body-sm uppercase tracking-wider text-text-muted">Marketplace balance</h2>
        <p className="text-3xl font-medium sm:text-5xl">Unavailable <span className="text-body-sm text-text-muted">USDT</span></p>
        <p className="text-body-sm text-text-muted">Balances are denominated in USDT, not US dollars. No balance is being reported before activation.</p>
      </div>
      <dl className="grid gap-5 border-t border-border pt-6 sm:grid-cols-3">
        {[
          ["Available", "Cleared funds for internal purchases."],
          ["Pending", "Seller proceeds during the 24-hour hold."],
          ["Reserved", "Actual committed reservations, when present."],
        ].map(([name, description]) => <div key={name} className="space-y-2">
          <dt className="font-semibold">{name}</dt>
          <dd className="text-heading-lg">Not active</dd>
          <dd className="text-body-sm text-text-muted">{description}</dd>
        </div>)}
      </dl>
    </section>
    <div className="grid gap-4 md:grid-cols-2">
      <nav aria-label="Wallet actions" className="grid gap-3">
        <button type="button" disabled aria-describedby="wallet-disabled" className="surface flex cursor-not-allowed items-center gap-4 p-5 text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-trust/10 text-trust"><Plus aria-hidden="true" /></span>
          <span><span className="block text-heading-md">Top Up — unavailable</span><span className="text-body-sm text-text-muted">Funding is not activated.</span></span>
        </button>
        <button type="button" disabled aria-describedby="wallet-disabled" className="surface flex cursor-not-allowed items-center gap-4 p-5 text-left">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-danger/10 text-danger"><ArrowDown aria-hidden="true" /></span>
          <span><span className="block text-heading-md">Withdraw — unavailable</span><span className="text-body-sm text-text-muted">External cash-out is unavailable.</span></span>
        </button>
        <a href="#wallet-transactions" className="surface flex items-center gap-4 p-5 transition hover:border-border-strong">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><List aria-hidden="true" /></span>
          <span className="text-heading-md">Transactions</span>
        </a>
      </nav>
      <dl className="grid gap-3">
        {[
          { label: "Total deposited", Icon: ArrowDown, color: "text-trust bg-trust/10" },
          { label: "Total withdrawn", Icon: ArrowUp, color: "text-danger bg-danger/10" },
          { label: "Total transactions", Icon: List, color: "text-primary bg-primary/10" },
        ].map(({ label, Icon, color }) => <div key={label} className="surface flex items-center gap-4 p-5">
          <span className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${color}`}><Icon aria-hidden="true" /></span>
          <div><dt className="text-body-sm text-text-muted">{label}</dt><dd className="text-heading-md">Unavailable</dd></div>
        </div>)}
      </dl>
    </div>
    <section aria-labelledby="wallet-policy" className="surface space-y-4 p-6">
      <h2 id="wallet-policy" className="text-heading-lg">Marketplace balance policy</h2>
      <p>Settlement and internal balances use USDT on Ethereum (ERC-20), subject to merchant-account verification. Only verified pay-in assets will be offered. Do not send funds: no deposit address has been issued.</p>
      <p>Standard purchases transfer funds internally to the seller when payment commits. Seller proceeds become available for internal purchases after the 24-hour hold. External cash-out is unavailable.</p>
      <p>Deposits credit actual settled USDT after provider fees. There is no platform fee for deposits or purchases. Funded escrow and refunds are unavailable.</p>
      <p className="text-text-muted">USDT can lose its dollar peg. Your balance is a marketplace accounting record, not a personal on-chain wallet. Existing USD listing prices have not been converted.</p>
      <Link href="/settings/security" className="underline underline-offset-4">Review account security</Link>
    </section>
    <section id="wallet-transactions" aria-labelledby="wallet-transactions-title" className="surface space-y-3 p-6">
      <h2 id="wallet-transactions-title" className="text-heading-lg">Transactions</h2>
      <p className="text-text-muted">Financial activity is unavailable before activation. This view does not query or certify a balance or transaction history.</p>
      <p className="text-body-sm text-text-muted">Activity will distinguish deposits, purchases, reservations, escrow, settlements, refunds, adjustments and withdrawals.</p>
    </section>
  </div>;
}
