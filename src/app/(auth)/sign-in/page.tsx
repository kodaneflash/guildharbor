import { safeReturnPath } from "@/lib/return-path";
import type { Metadata } from "next";

import { SignInForm } from "@/components/auth-form";
import {
  isAppleConfigured,
  isDatabaseConfigured,
  isGoogleConfigured,
} from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  return (
    <SignInForm
      returnTo={returnTo}
      isAppleConfigured={isAppleConfigured}
      isConfigured={isDatabaseConfigured}
      isGoogleConfigured={isGoogleConfigured}
    />
  );
}
