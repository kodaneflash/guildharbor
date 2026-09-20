import { safeReturnPath } from "@/lib/return-path";
import { communityAccessMode } from "@/lib/community-access";
import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth-form";
import {
  isAppleConfigured,
  isDatabaseConfigured,
  isGoogleConfigured,
} from "@/lib/env";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  return (
    <SignUpForm
      returnTo={returnTo}
      requiresApproval={communityAccessMode() === "private"}
      isAppleConfigured={isAppleConfigured}
      isConfigured={isDatabaseConfigured}
      isGoogleConfigured={isGoogleConfigured}
    />
  );
}
