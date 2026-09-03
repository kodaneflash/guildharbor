import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

export type RateLimitName = "auth" | "registration" | "otp" | "thread" | "reply" | "reputation" | "vouch" | "message" | "report" | "search" | "upload";

const limits: Record<RateLimitName, { count: number; window: `${number} ${"s" | "m" | "h" | "d"}` }> = {
  auth: { count: 5, window: "10 m" },
  registration: { count: 3, window: "1 h" },
  otp: { count: 3, window: "15 m" },
  thread: { count: 5, window: "10 m" },
  reply: { count: 10, window: "1 m" },
  reputation: { count: 5, window: "1 d" },
  vouch: { count: 3, window: "1 d" },
  message: { count: 30, window: "1 m" },
  report: { count: 10, window: "1 d" },
  search: { count: 60, window: "1 m" },
  upload: { count: 20, window: "1 h" },
};

const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const rateLimiters = new Map<RateLimitName, Ratelimit>();

export async function enforceRateLimit(name: RateLimitName, identifier: string) {
  if (!redis) {
    if (env.NODE_ENV === "production") throw new Error("Rate limiting is not configured");
    return { success: true, remaining: limits[name].count };
  }
  const config = limits[name];
  let limiter = rateLimiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(config.count, config.window), prefix: `guildharbor:${name}` });
    rateLimiters.set(name, limiter);
  }
  const result = await limiter.limit(identifier);
  if (!result.success) throw new Error("RATE_LIMITED");
  return result;
}
