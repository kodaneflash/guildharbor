import { AccountFlowForm } from "@/components/account-flow-form";
import { isDatabaseConfigured } from "@/lib/env";
export default function ResetPasswordPage() { return <AccountFlowForm flow="reset" isConfigured={isDatabaseConfigured} />; }
