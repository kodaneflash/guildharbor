import "server-only";
import { createCipheriv, randomBytes } from "node:crypto";
export function encryptDeliverable(text: string) {
  const key = process.env.DELIVERY_ENCRYPTION_KEY;
  if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("Protected delivery requires a configured 32-byte DELIVERY_ENCRYPTION_KEY");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), nonce);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export async function revealSellerDeliverable(listingId: string) {
  const { createDecipheriv } = await import("node:crypto");
  const { and, eq } = await import("drizzle-orm");
  const { createReadDatabase } = await import("@/db/client");
  const { listings, listingRevisions } = await import("@/db/schema");
  const { requireMember } = await import("@/lib/session");
  const { z } = await import("zod");
  z.uuid().parse(listingId); const access = await requireMember();
  const [row] = await createReadDatabase().select({ payload: listingRevisions.protectedText }).from(listings).innerJoin(listingRevisions, and(eq(listingRevisions.listingId, listings.id), eq(listingRevisions.version, listings.version))).where(and(eq(listings.id, listingId), eq(listings.sellerId, access.user.id)));
  if (!row?.payload) throw new Error("No protected text available to this account");
  const key = process.env.DELIVERY_ENCRYPTION_KEY; if (!key || !/^[a-f0-9]{64}$/i.test(key)) throw new Error("Protected delivery key unavailable");
  const [version, nonce, tag, ciphertext] = row.payload.split(":"); if (version !== "v1" || !nonce || !tag || !ciphertext) throw new Error("Unsupported protected payload");
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(nonce, "base64")); decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}
