import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth-form";
import {
  isAppleConfigured,
  isDatabaseConfigured,
  isGoogleConfigured,
} from "@/lib/env";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: false } };
export default function SignUpPage() {
  return (
    <SignUpForm
      isAppleConfigured={isAppleConfigured}
      isConfigured={isDatabaseConfigured}
      isGoogleConfigured={isGoogleConfigured}
    />
  );
}
