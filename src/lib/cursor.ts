import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

const cursorSchema = z.object({
  v: z.literal(1),
  sort: z.string().min(1).max(40),
  id: z.number().int().positive(),
  at: z.string().datetime().optional(),
  pinned: z.boolean().optional(),
});

export type PageCursor = z.infer<typeof cursorSchema>;

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function encodeCursor(cursor: PageCursor, secret: string) {
  const payload = Buffer.from(JSON.stringify(cursor)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function decodeCursor(value: string | undefined, secret: string) {
  if (!value) return null;
  const [payload, providedSignature] = value.split(".");
  if (!payload || !providedSignature) return null;
  const expectedSignature = signature(payload, secret);
  const left = Buffer.from(providedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}
