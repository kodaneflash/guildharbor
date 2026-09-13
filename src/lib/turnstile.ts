import "server-only";
import { APIError } from "better-auth/api";
import { env } from "@/lib/env";
export async function verifyTurnstile(token: string | null | undefined) {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (env.NODE_ENV === "production")
      throw new APIError("SERVICE_UNAVAILABLE", {
        message: "Registration verification is not configured.",
      });
    return;
  }
  if (!token || token.length > 2048)
    throw new APIError("BAD_REQUEST", {
      message: "Complete the security verification.",
    });
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new APIError("SERVICE_UNAVAILABLE", {
      message: "Security verification is unavailable. Try again.",
    });
  const result = (await response.json()) as {
    success: boolean;
    hostname?: string;
    action?: string;
  };
  const expectedHost = new URL(
    env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  ).hostname;
  if (
    !result.success ||
    result.hostname !== expectedHost ||
    result.action !== "registration"
  )
    throw new APIError("BAD_REQUEST", {
      message: "Security verification failed. Please try again.",
    });
}
