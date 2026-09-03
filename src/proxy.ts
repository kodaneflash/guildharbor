import { randomBytes } from "node:crypto";

import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/env";

const protectedPrefixes = ["/messages", "/settings", "/moderation", "/admin", "/threads/new"];
const authenticationPaths = new Set(["/sign-in", "/sign-up"]);
const usernameOnboardingPath = "/onboarding/username";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtectedPath = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const hasSessionCookie = Boolean(getSessionCookie(request));
  const shouldResolveSession =
    isDatabaseConfigured &&
    hasSessionCookie &&
    (isProtectedPath ||
      pathname === usernameOnboardingPath ||
      authenticationPaths.has(pathname));

  if (
    isDatabaseConfigured &&
    (isProtectedPath || pathname === usernameOnboardingPath) &&
    !hasSessionCookie
  ) {
    return redirectToSignIn(request);
  }

  if (shouldResolveSession && auth) {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session && (isProtectedPath || pathname === usernameOnboardingPath)) {
      return redirectToSignIn(request);
    }

    if (session) {
      const needsUsername =
        session.user.accountStatus === "pending_username" ||
        !session.user.username;

      if (needsUsername && pathname !== usernameOnboardingPath) {
        return NextResponse.redirect(
          new URL(usernameOnboardingPath, request.url),
        );
      }

      if (!needsUsername && pathname === usernameOnboardingPath) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  const nonce = randomBytes(16).toString("base64");
  const isProduction = process.env.NODE_ENV === "production";
  const contentSecurityPolicy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.r2.dev",
    "font-src 'self' data:",
    "connect-src 'self' https://*.neon.tech wss://*.neon.tech https://*.upstash.io https://appleid.apple.com https://accounts.google.com https://oauth2.googleapis.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://appleid.apple.com https://accounts.google.com",
    "frame-ancestors 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  if (isProduction) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  return response;
}

export const config = { matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };

function redirectToSignIn(request: NextRequest) {
  const signInUrl = new URL("/sign-in", request.url);
  signInUrl.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}
