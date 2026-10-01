import { safeReturnPath } from "@/lib/return-path";
import type { Metadata } from "next";

import { FamilyWalletDemo } from "@/components/family-wallet/family-wallet-demo";
import {
  isDatabaseConfigured,
  isGoogleConfigured,
} from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default async function SignInPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const returnTo = safeReturnPath((await searchParams).returnTo);
  return (
    <FamilyWalletDemo
      returnTo={returnTo}
      isConfigured={isDatabaseConfigured}
      isGoogleConfigured={isGoogleConfigured}
    />
  );
}
