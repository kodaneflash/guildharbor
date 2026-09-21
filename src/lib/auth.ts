import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { usernameSchema } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, twoFactor, username } from "better-auth/plugins";
import { and, eq, inArray } from "drizzle-orm";

import { createReadDatabase } from "@/db/client";
import * as schema from "@/db/schema";
import { users } from "@/db/schema";
import { generateAppleClientSecret } from "@/lib/apple";
import { sendOtpEmail } from "@/lib/email";
import {
  env,
  isAppleConfigured,
  isDatabaseConfigured,
  isGoogleConfigured,
} from "@/lib/env";

function createAuth() {
  const database = createReadDatabase();
  const socialProviders = {
    ...(isGoogleConfigured
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
            prompt: "select_account" as const,
          },
        }
      : {}),
    ...(isAppleConfigured
      ? {
          apple: async () => ({
            clientId: env.APPLE_CLIENT_ID ?? "",
            clientSecret: await generateAppleClientSecret(),
            appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
          }),
        }
      : {}),
  };

  return betterAuth({
    appName: "GuildHarbor",
    baseURL: env.BETTER_AUTH_URL || env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema,
      usePlural: true,
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    user: {
      additionalFields: {
        accountStatus: {
          type: "string",
          required: false,
          defaultValue: "pending_email",
          input: false,
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Email OTP is for verification/reset only; password sign-in enforces TOTP.
        if (ctx.path === "/sign-in/email-otp")
          throw new APIError("FORBIDDEN", {
            message: "Sign in with your password or social provider.",
          });
        if (ctx.path === "/sign-up/email") {
          if (!usernameSchema.safeParse(ctx.body?.username).success)
            throw new APIError("BAD_REQUEST", {
              message: "Choose a valid, available username.",
            });
        }
        if (["/sign-up/email", "/sign-in/social"].includes(ctx.path)) {
          await verifyTurnstile(ctx.headers?.get("x-turnstile-token"));
        }
      }),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            // Provisioning is also guaranteed atomically by the database trigger.
            const status = user.emailVerified
              ? "username" in user && typeof user.username === "string"
                ? "active"
                : "pending_username"
              : "pending_email";
            await database
              .update(users)
              .set({ accountStatus: status })
              .where(eq(users.id, user.id));
          },
        },
        update: {
          after: async (user) => {
            if (!user.emailVerified) return;
            const usernameValue = "username" in user ? user.username : null;
            await database
              .update(users)
              .set({
                accountStatus:
                  typeof usernameValue === "string"
                    ? "active"
                    : "pending_username",
              })
              .where(
                and(
                  eq(users.id, user.id),
                  inArray(users.accountStatus, [
                    "pending_email",
                    "pending_username",
                  ]),
                ),
              );
          },
        },
      },
    },
    trustedOrigins: [
      ...(env.NEXT_PUBLIC_APP_URL ? [env.NEXT_PUBLIC_APP_URL] : []),
      ...(isAppleConfigured ? ["https://appleid.apple.com"] : []),
      ...(isGoogleConfigured ? ["https://accounts.google.com"] : []),
    ],
    socialProviders:
      Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
    advanced: {
      cookiePrefix: "guildharbor",
      useSecureCookies: env.NODE_ENV === "production",
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 20,
    },
    plugins: [
      username({
        validationOrder: { username: "post-normalization" },
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator(value) {
          return usernameSchema.safeParse(value).success;
        },
        usernameNormalization(value) {
          return value.trim().toLowerCase();
        },
      }),
      emailOTP({
        sendVerificationOTP: sendOtpEmail,
        changeEmail: { enabled: true, verifyCurrentEmail: true },
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOnSignUp: true,
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        rateLimit: { window: 60, max: 3 },
      }),
      twoFactor({
        issuer: "GuildHarbor",
        backupCodeOptions: {
          amount: 10,
          length: 12,
          storeBackupCodes: "encrypted",
        },
        accountLockout: {
          enabled: true,
          maxFailedAttempts: 5,
          durationSeconds: 900,
        },
      }),
      nextCookies(),
    ],
  });
}

export const auth = isDatabaseConfigured ? createAuth() : null;

export type Auth = NonNullable<typeof auth>;
