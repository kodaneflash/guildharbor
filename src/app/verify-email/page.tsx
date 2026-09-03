import type { Metadata } from "next";

import { VerifyEmailForm } from "@/components/auth-form";
import { isDatabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Verify email", robots: { index: false, follow: false } };
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) { const { email = "" } = await searchParams; return <VerifyEmailForm isConfigured={isDatabaseConfigured} email={email} />; }
