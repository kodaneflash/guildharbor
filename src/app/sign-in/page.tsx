import type { Metadata } from "next";

import { SignInForm } from "@/components/auth-form";
import {
  isAppleConfigured,
  isDatabaseConfigured,
  isGoogleConfigured,
} from "@/lib/env";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default function SignInPage() {
  return (
    <SignInForm
      isAppleConfigured={isAppleConfigured}
      isConfigured={isDatabaseConfigured}
      isGoogleConfigured={isGoogleConfigured}
    />
  );
}
