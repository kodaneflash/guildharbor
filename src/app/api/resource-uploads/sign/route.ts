import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { allowedMediaTypes, authorizeFileResource, resourcePurpose } from "@/domains/delivery/file-service";
import { createReadDatabase } from "@/db/client";
import { attachments } from "@/db/schema";
import { createObjectStorageClient } from "@/lib/storage";
import { env, isR2Configured } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  const access = await memberApiAccess(request); if (access instanceof Response) return access;
  const input = z.object({ purpose: resourcePurpose, resourceId: z.string().min(1).max(100), name: z.string().min(1).max(180).regex(/^[^\x00-\x1f/\\]+$/), mediaType: z.enum(allowedMediaTypes), size: z.number().int().positive().max(10485760), checksum: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(await request.json());
  if (!input.success) return Response.json({ error: "Invalid file metadata" }, { status: 400, headers: privateHeaders });
  if (input.data.purpose === "listing_media" && !input.data.mediaType.startsWith("image/")) return Response.json({ error: "Listing media must be JPEG, PNG or WebP" }, { status: 400, headers: privateHeaders });
  if (!isR2Configured || !process.env.FILE_SCANNER_URL || !process.env.FILE_SCANNER_TOKEN) return Response.json({ error: "Secure file processing is unavailable" }, { status: 503, headers: privateHeaders });
  if (!(await authorizeFileResource(input.data.purpose, input.data.resourceId, true))) return Response.json({ error: "Forbidden" }, { status: 403, headers: privateHeaders });
  await enforceRateLimit("upload", access.user.id);
  const id = randomUUID(); const key = `quarantine/resources/${access.user.id}/${id}`;
  const url = await getSignedUrl(createObjectStorageClient(), new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: input.data.mediaType, ContentLength: input.data.size, ChecksumSHA256: Buffer.from(input.data.checksum, "hex").toString("base64") }), { expiresIn: 300 });
  await createReadDatabase().insert(attachments).values({ id, ownerId: access.user.id, purpose: input.data.purpose, resourceId: input.data.resourceId, originalName: input.data.name, storageKey: key, mediaType: input.data.mediaType, byteSize: input.data.size, checksum: input.data.checksum });
  return Response.json({ id, url }, { headers: privateHeaders });
}
