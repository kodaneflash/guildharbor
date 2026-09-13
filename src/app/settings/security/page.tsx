import { and, eq } from "drizzle-orm";
import { communityNotice } from "@/components/access-notice";
import { SettingsNav } from "@/components/settings-nav";
import { SecurityForm } from "@/components/security-form";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { accounts } from "@/db/schema";
export default async function SecurityPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await requireMember();
  const [credential] = await createReadDatabase()
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, access.user.id),
        eq(accounts.providerId, "credential"),
      ),
    )
    .limit(1);
  return (
    <div className="site-container py-8">
      <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsNav active="security" />
        <div className="max-w-3xl space-y-5">
          <h1 className="text-3xl font-extrabold">Security</h1>
          <SecurityForm
            enabled={Boolean(access.user.twoFactorEnabled)}
            hasPassword={Boolean(credential)}
          />
        </div>
      </div>
    </div>
  );
}
