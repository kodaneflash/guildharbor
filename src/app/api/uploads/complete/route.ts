import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";

import { createReadDatabase } from "@/db/client";
import { attachments } from "@/db/schema";
import { env, isR2Configured } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { createObjectStorageClient } from "@/lib/storage";

const inputSchema = z.object({ attachmentId: z.uuid() }).strict();
const allowedFormats = new Set(["jpeg", "png", "webp"]);

export async function POST(request: Request) {
  if (!isR2Configured) return Response.json({ error: "Uploads are not configured." }, { status: 503 });
  try {
    const session = await requireSession();
    await enforceRateLimit("upload", session.user.id);
    const input = inputSchema.parse(await request.json());
    const database = createReadDatabase();
    const [attachment] = await database.select().from(attachments).where(and(eq(attachments.id, input.attachmentId), eq(attachments.ownerId, session.user.id), eq(attachments.state, "pending"))).limit(1);
    if (!attachment || !attachment.storageKey.startsWith(`quarantine/${session.user.id}/`)) return Response.json({ error: "Attachment not found" }, { status: 404 });
    const storage = createObjectStorageClient();
    const object = await storage.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: attachment.storageKey }));
    if (!object.Body) throw new Error("Uploaded object is empty");
    const source = Buffer.from(await object.Body.transformToByteArray());
    if (source.byteLength !== attachment.byteSize || source.byteLength > 10 * 1024 * 1024) throw new Error("Uploaded object size mismatch");
    const checksum = createHash("sha256").update(source).digest("hex");
    if (checksum !== attachment.checksum) throw new Error("Uploaded object checksum mismatch");
    const image = sharp(source, { failOn: "error", limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (!metadata.format || !allowedFormats.has(metadata.format) || !metadata.width || !metadata.height) throw new Error("Unsupported image format");
    const processed = await image.rotate().resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
    const permanentKey = `images/${session.user.id}/${attachment.id}.webp`;
    await storage.send(new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: permanentKey, Body: processed, ContentType: "image/webp", CacheControl: "private, max-age=31536000, immutable" }));
    await storage.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: attachment.storageKey }));
    await database.update(attachments).set({ state: "ready", storageKey: permanentKey, mediaType: "image/webp", byteSize: processed.byteLength, width: metadata.width, height: metadata.height }).where(eq(attachments.id, attachment.id));
    return Response.json({ attachmentId: attachment.id, state: "ready", width: metadata.width, height: metadata.height });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid completion request" }, { status: 400 });
    return Response.json({ error: "Uploaded image failed validation" }, { status: 422 });
  }
}
