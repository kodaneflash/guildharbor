import { z } from "zod";
export const sellerPolicyVersion = "2026-09-pre-funding-v1";
export const sellerSchema = z.object({ name: z.string().trim().min(2).max(80), description: z.string().trim().min(20).max(5000), acceptedPolicy: z.literal("on") });
export const usdPrice = z.string().trim().regex(/^\d{1,8}(?:\.\d{1,2})?$/, "Enter a positive USD price with at most two decimal places.").transform(value => { const [whole, fraction = ""] = value.split("."); return Number(whole) * 100 + Number(fraction.padEnd(2, "0")); }).pipe(z.number().int().min(1).max(2147483647));
export const listingSchema = z.object({
  id: z.uuid().optional(), version: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(5).max(160), description: z.string().trim().min(20).max(20000),
  categoryId: z.union([z.uuid(), z.literal("")]).transform(value => value || null),
  kind: z.enum(["digital", "service"]), fulfillmentMode: z.enum(["text", "file", "manual"]),
  deliveryTerms: z.string().trim().min(10).max(5000), price: usdPrice,
  protectedText: z.string().max(100000).default(""), available: z.boolean(),
  status: z.enum(["draft", "published", "paused", "archived"]),
});
export function formatUsd(cents: number) { return `$${Math.floor(cents / 100).toLocaleString("en-US")}.${String(cents % 100).padStart(2, "0")} USD`; }
export function listingSlug(title: string) { return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "listing"; }
