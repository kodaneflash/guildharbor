import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { attachments } from "@/db/schema";
import { env, isR2Configured } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { createObjectStorageClient } from "@/lib/storage";
const inputSchema = z
  .object({
    purpose: z.literal("avatar"),
    fileName: z.string().min(1).max(180),
    size: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export async function POST(request: Request) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  if (!isR2Configured)
    return Response.json(
      { error: "Uploads are not configured." },
      { status: 503, headers: privateHeaders },
    );
  await enforceRateLimit("upload", access.user.id);
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Choose a JPEG, PNG or WebP image up to 10 MB." },
      { status: 400, headers: privateHeaders },
    );
  const input = parsed.data;
  const id = randomUUID();
  const storageKey = `quarantine/${access.user.id}/${id}`;
  const checksum = Buffer.from(input.checksum, "hex").toString("base64");
  const uploadUrl = await getSignedUrl(
    createObjectStorageClient(),
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: storageKey,
      ContentType: input.mediaType,
      ContentLength: input.size,
      ChecksumSHA256: checksum,
    }),
    { expiresIn: 300 },
  );
  await createReadDatabase()
    .insert(attachments)
    .values({
      id,
      ownerId: access.user.id,
      purpose: "avatar",
      storageKey,
      mediaType: input.mediaType,
      byteSize: input.size,
      checksum: input.checksum,
    });
  return Response.json(
    { attachmentId: id, uploadUrl, checksum, expiresIn: 300 },
    { headers: privateHeaders },
  );
}
