import Link from "next/link";

import { requireMember } from "@/lib/session";

export default async function RefundsPage() {
  await requireMember();

  return (
    <div className="site-container max-w-3xl space-y-5 py-8">
      <h1 className="text-display-sm">Refunds</h1>
      <section className="surface space-y-4 p-6">
        <p>
          There are no refunds to display. Payments and funded orders are not
          available in the current release.
        </p>
        <p className="text-text-muted">
          If you need help with an agreement or account issue, open a support
          case and include the relevant details.
        </p>
        <Link className="button-secondary" href="/support">
          Contact support
        </Link>
      </section>
    </div>
  );
}
