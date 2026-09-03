import "server-only";

import { importPKCS8, SignJWT } from "jose";

import { env } from "@/lib/env";

export async function generateAppleClientSecret() {
  if (
    !env.APPLE_CLIENT_ID ||
    !env.APPLE_TEAM_ID ||
    !env.APPLE_KEY_ID ||
    !env.APPLE_PRIVATE_KEY
  ) {
    throw new Error("Apple OAuth is not configured");
  }

  const privateKey = env.APPLE_PRIVATE_KEY.replaceAll("\\n", "\n");
  const key = await importPKCS8(privateKey, "ES256");
  const issuedAt = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APPLE_KEY_ID })
    .setIssuer(env.APPLE_TEAM_ID)
    .setSubject(env.APPLE_CLIENT_ID)
    .setAudience("https://appleid.apple.com")
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 180 * 24 * 60 * 60)
    .sign(key);
}
