import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { FinanceTransaction } from "./database";
import { financialCommands, financialEvidence } from "@/db/schema";

const commandInput = z.object({ ownerId: z.string().min(1), requestId: z.uuid(), kind: z.enum(["deposit", "withdrawal"]), requestDigest: z.string().regex(/^[0-9a-f]{64}$/) });

/** Called only after the member/security/business-policy boundary has passed. */
export async function prepareCommand(tx: FinanceTransaction, input: z.infer<typeof commandInput>) {
  const data = commandInput.parse(input);
  await tx.insert(financialCommands).values(data).onConflictDoNothing();
  const [command] = await tx.select().from(financialCommands).where(and(eq(financialCommands.requestId, data.requestId), eq(financialCommands.ownerId, data.ownerId)))
    .for("update");
  if (!command || command.ownerId !== data.ownerId || command.kind !== data.kind || command.requestDigest !== data.requestDigest) {
    throw new Error("Financial request ID reused with different instructions.");
  }
  return command;
}

/** Commit this claim BEFORE a provider POST. There is no automatic re-claim:
 * a crash is indistinguishable from a completed external mutation.
 */
export async function claimCommand(tx: FinanceTransaction, id: string) {
  const [command] = await tx.select().from(financialCommands).where(eq(financialCommands.id, z.uuid().parse(id))).for("update");
  if (!command) throw new Error("Financial command unavailable.");
  if (command.state !== "prepared") return false;
  await tx.update(financialCommands).set({ state: "outcome_unknown" }).where(eq(financialCommands.id, id));
  return true;
}

/** The caller must first validate a provider response/lookup against the exact
 * command. An IPN's unverified order_id is never sufficient to identify it.
 */
export async function identifyCommand(tx: FinanceTransaction, id: string, providerId: string) {
  z.string().regex(/^\d{1,40}$/).parse(providerId);
  const [command] = await tx.select().from(financialCommands).where(eq(financialCommands.id, z.uuid().parse(id))).for("update");
  if (!command || command.state === "prepared") throw new Error("Financial command has not been submitted.");
  if (command.providerId && command.providerId !== providerId) throw new Error("Provider reference conflict requires review.");
  await tx.update(financialCommands).set({ state: "identified", providerId }).where(eq(financialCommands.id, id));
}

export function encryptEvidence(body: string, keyHex: string, keyVersion: string, digest: string) {
  if (!/^[0-9a-f]{64}$/i.test(keyHex) || !/^[a-zA-Z0-9_-]{1,40}$/.test(keyVersion) || !/^[0-9a-f]{64}$/.test(digest)) {
    throw new Error("Invalid financial evidence encryption configuration.");
  }
  if (Buffer.byteLength(body, "utf8") > 262_144) throw new Error("Financial evidence exceeds size limit.");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), nonce);
  cipher.setAAD(Buffer.from(`${keyVersion}:${digest}`));
  const encrypted = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  return [nonce.toString("base64"), cipher.getAuthTag().toString("base64"), encrypted.toString("base64")].join(":");
}

export async function retainEvidence(tx: FinanceTransaction, input: {
  commandId?: string; source: "ipn" | "lookup" | "command"; digest: string;
  body: string; keyHex: string; keyVersion: string;
}) {
  const encryptedBody = encryptEvidence(input.body, input.keyHex, input.keyVersion, input.digest);
  const [record] = await tx.insert(financialEvidence).values({ commandId: input.commandId, source: input.source, digest: input.digest, encryptedBody, keyVersion: input.keyVersion })
    .onConflictDoNothing({ target: [financialEvidence.source, financialEvidence.digest] }).returning({ id: financialEvidence.id });
  if (record) return { inserted: true, id: record.id };
  const [existing] = await tx.select({ id: financialEvidence.id }).from(financialEvidence)
    .where(and(eq(financialEvidence.source, input.source), eq(financialEvidence.digest, input.digest)));
  if (!existing) throw new Error("Evidence receipt unavailable.");
  return { inserted: false, id: existing.id };
}

/** Only command-response evidence uses a raw-body digest; IPNs use their
 * provider-defined canonical digest and must not use this decoder. */
export function decryptRetainedEvidence(record: { encryptedBody: string; digest: string; keyVersion: string; source?: string }, keyHex: string, keyVersion: string) {
  if (record.keyVersion !== keyVersion || !/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error("Evidence key version unavailable.");
  const parts = record.encryptedBody.split(":");
  if (parts.length !== 3) throw new Error("Invalid retained evidence.");
  const [nonce, tag, ciphertext] = parts.map(value => Buffer.from(value, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), nonce);
  decipher.setAAD(Buffer.from(`${record.keyVersion}:${record.digest}`));
  decipher.setAuthTag(tag);
  const body = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  if (record.source !== "ipn" && createHash("sha256").update(body).digest("hex") !== record.digest) throw new Error("Retained evidence digest mismatch.");
  return body;
}

export const decryptCommandEvidence = decryptRetainedEvidence;
