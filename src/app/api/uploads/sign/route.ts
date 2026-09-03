import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { createReadDatabase } from "@/db/client";
import { attachments } from "@/db/schema";
import { env, isR2Configured } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireSession } from "@/lib/session";
import { createObjectStorageClient } from "@/lib/storage";

const inputSchema = z.object({ purpose: z.enum(["avatar", "banner", "post", "message"]), fileName: z.string().min(1).max(180), size: z.number().int().positive().max(10 * 1024 * 1024), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), checksum: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export async function POST(request: Request) {
  if (!isR2Configured) return Response.json({ error: "Uploads are not configured." }, { status: 503 });
  try {
    const session = await requireSession();
    await enforceRateLimit("upload", session.user.id);
    const input = inputSchema.parse(await request.json());
    const attachmentId = randomUUID();
    const extension = input.mediaType === "image/jpeg" ? "jpg" : input.mediaType.split("/")[1];
    const objectKey = `quarantine/${session.user.id}/${attachmentId}.${extension}`;
    const client = createObjectStorageClient();
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey, ContentType: input.mediaType, ContentLength: input.size, ChecksumSHA256: Buffer.from(input.checksum, "hex").toString("base64") }), { expiresIn: 300 });
    const database = createReadDatabase();
    await database.insert(attachments).values({ id: attachmentId, ownerId: session.user.id, purpose: input.purpose, storageKey: objectKey, mediaType: input.mediaType, byteSize: input.size, checksum: input.checksum });
    return Response.json({ attachmentId, objectKey, uploadUrl, expiresIn: 300 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: "Invalid upload request", details: error.flatten().fieldErrors }, { status: 400 });
    return Response.json({ error: "Upload signing failed" }, { status: 401 });
  }
}
