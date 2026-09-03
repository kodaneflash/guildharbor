import { AccountFlowForm } from "@/components/account-flow-form";
import { isDatabaseConfigured } from "@/lib/env";
export default function ForgotPasswordPage() { return <AccountFlowForm flow="forgot" isConfigured={isDatabaseConfigured} />; }
