import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
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

const usernamePattern = /^[a-zA-Z0-9_.]+$/;
const reservedUsernames = new Set([
  "admin",
  "administrator",
  "api",
  "auth",
  "guildharbor",
  "help",
  "moderator",
  "root",
  "security",
  "staff",
  "support",
]);

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
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            const status = user.emailVerified
              ? "username" in user && typeof user.username === "string"
                ? "active"
                : "pending_username"
              : "pending_email";
            await database.update(users).set({ accountStatus: status }).where(eq(users.id, user.id));
          },
        },
        update: {
          after: async (user) => {
            if (!user.emailVerified) return;
            const usernameValue = "username" in user ? user.username : null;
            await database
              .update(users)
              .set({ accountStatus: typeof usernameValue === "string" ? "active" : "pending_username" })
              .where(and(eq(users.id, user.id), inArray(users.accountStatus, ["pending_email", "pending_username"])));
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
        minUsernameLength: 3,
        maxUsernameLength: 30,
        usernameValidator(value) {
          return usernamePattern.test(value) && !reservedUsernames.has(value.toLowerCase());
        },
        usernameNormalization(value) {
          return value.toLowerCase();
        },
      }),
      emailOTP({
        sendVerificationOTP: sendOtpEmail,
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
