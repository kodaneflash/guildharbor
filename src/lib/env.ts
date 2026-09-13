import "server-only";

import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  COMMUNITY_ACCESS_MODE: z.enum(["public", "private"]).default("private"),
  DATABASE_URL: optionalUrl,
  DATABASE_URL_UNPOOLED: optionalUrl,
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: optionalUrl,
  NEXT_PUBLIC_APP_URL: optionalUrl,
  RESEND_API_KEY: z.string().optional(),
  AUTH_EMAIL_FROM: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  APPLE_CLIENT_ID: z.string().optional(),
  APPLE_TEAM_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),
  APPLE_APP_BUNDLE_IDENTIFIER: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  MAINTENANCE_SECRET: z.string().min(24).optional(),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(
    `Invalid server environment: ${z.prettifyError(parsedEnvironment.error)}`,
  );
}

export const env = parsedEnvironment.data;

export const isDatabaseConfigured = Boolean(
  env.DATABASE_URL && env.BETTER_AUTH_SECRET,
);

export const isAppleConfigured = Boolean(
  env.APPLE_CLIENT_ID &&
  env.APPLE_TEAM_ID &&
  env.APPLE_KEY_ID &&
  env.APPLE_PRIVATE_KEY,
);

export const isGoogleConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET,
);

export const isR2Configured = Boolean(
  env.R2_ACCOUNT_ID &&
  env.R2_ACCESS_KEY_ID &&
  env.R2_SECRET_ACCESS_KEY &&
  env.R2_BUCKET,
);
