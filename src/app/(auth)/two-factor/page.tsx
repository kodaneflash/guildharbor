import { AccountFlowForm } from "@/components/account-flow-form";
import { isDatabaseConfigured } from "@/lib/env";
import { safeReturnPath } from "@/lib/return-path";
export default async function TwoFactorPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  return <AccountFlowForm flow="two-factor" isConfigured={isDatabaseConfigured} returnTo={safeReturnPath((await searchParams).returnTo)} />;
}
