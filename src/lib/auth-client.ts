"use client";

import { safeReturnPath } from "@/lib/return-path";
import { createAuthClient } from "better-auth/react";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        const returnTo = safeReturnPath(new URL(window.location.href).searchParams.get("returnTo"));
        window.location.assign(`/two-factor?returnTo=${encodeURIComponent(returnTo)}`);
      },
    }),
  ],
});
