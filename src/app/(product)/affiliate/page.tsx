import { requireMember } from "@/lib/session";

export default async function AffiliatePage() {
  await requireMember();

  return (
    <div className="site-container max-w-3xl space-y-5 py-8">
      <h1 className="text-display-sm">Affiliate</h1>
      <section className="surface space-y-3 p-6">
        <h2 className="text-heading-lg">Affiliate program</h2>
        <p>
          The affiliate program is not active yet. Referral links, tracking,
          and monetary awards are unavailable in this release.
        </p>
      </section>
    </div>
  );
}
