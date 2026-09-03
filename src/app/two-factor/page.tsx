import { AccountFlowForm } from "@/components/account-flow-form";
import { isDatabaseConfigured } from "@/lib/env";
export default function TwoFactorPage() { return <AccountFlowForm flow="two-factor" isConfigured={isDatabaseConfigured} />; }
