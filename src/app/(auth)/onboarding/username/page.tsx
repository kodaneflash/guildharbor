import { safeReturnPath } from "@/lib/return-path";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AccountFlowForm } from "@/components/account-flow-form";
import { isDatabaseConfigured } from "@/lib/env";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Choose a username",
  robots: { index: false, follow: false },
};

export default async function UsernameOnboardingPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  const session = await getSession();

  if (!session) redirect("/sign-in?returnTo=/onboarding/username");
  if (!session.user.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(session.user.email)}`);
  }
  if (session.user.username) redirect(returnTo);

  return (
    <AccountFlowForm
      flow="username"
      returnTo={returnTo}
      isConfigured={isDatabaseConfigured}
    />
  );
}
