import { hasCommunityAccess } from "@/lib/community-access";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import sharp from "sharp";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { withTransaction } from "@/db/transaction";
import { attachments, profiles, users } from "@/db/schema";
import { env, isR2Configured } from "@/lib/env";
import { enforceRateLimit } from "@/lib/rate-limit";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { createObjectStorageClient } from "@/lib/storage";
const inputSchema = z.object({ attachmentId: z.uuid() }).strict();
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
      { error: "Invalid completion request." },
      { status: 400, headers: privateHeaders },
    );
  const database = createReadDatabase();
  const [attachment] = await database
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, parsed.data.attachmentId),
        eq(attachments.ownerId, access.user.id),
        eq(attachments.purpose, "avatar"),
      ),
    )
    .limit(1);
  if (!attachment)
    return Response.json(
      { error: "Upload not found." },
      { status: 404, headers: privateHeaders },
    );
  const avatarUrl = `/api/files/${attachment.id}`;
  if (attachment.state === "ready")
    return Response.json({ avatarUrl }, { headers: privateHeaders });
  if (
    attachment.state !== "pending" ||
    Date.now() - attachment.createdAt.getTime() > 15 * 60 * 1000
  )
    return Response.json(
      { error: "Upload expired. Choose the image again." },
      { status: 409, headers: privateHeaders },
    );
  const storage = createObjectStorageClient();
  const object = await storage.send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: attachment.storageKey }),
  );
  let processed;
  try {
    if (
      !object.Body ||
      object.ContentLength !== attachment.byteSize ||
      object.ContentLength > 10485760
    )
      throw new Error("Invalid size");
    const source = Buffer.from(await object.Body.transformToByteArray());
    if (
      source.length !== attachment.byteSize ||
      createHash("sha256").update(source).digest("hex") !== attachment.checksum
    )
      throw new Error("Invalid checksum");
    const image = sharp(source, {
      failOn: "error",
      limitInputPixels: 40000000,
    });
    const metadata = await image.metadata();
    if (
      !metadata.format ||
      !["jpeg", "png", "webp"].includes(metadata.format) ||
      (metadata.pages ?? 1) > 1
    )
      throw new Error("Unsupported image");
    processed = await image
      .rotate()
      .resize({
        width: 512,
        height: 512,
        fit: "cover",
        withoutEnlargement: true,
      })
      .webp({ quality: 88 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    await database
      .update(attachments)
      .set({ state: "rejected" })
      .where(
        and(
          eq(attachments.id, attachment.id),
          eq(attachments.state, "pending"),
        ),
      );
    return Response.json(
      {
        error:
          "Image validation failed. Choose a valid JPEG, PNG or WebP image.",
      },
      { status: 422, headers: privateHeaders },
    );
  }
  const permanentKey = `avatars/${access.user.id}/${attachment.id}.webp`;
  await storage.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: permanentKey,
      Body: processed.data,
      ContentType: "image/webp",
      CacheControl: "private, no-store",
    }),
  );
  await withTransaction(async (transaction) => {
    const [actor] = await transaction
      .select()
      .from(users)
      .where(eq(users.id, access.user.id))
      .for("share");
    if (
      !hasCommunityAccess(actor ?? null)
    )
      throw new Error("FORBIDDEN");
    const [updated] = await transaction
      .update(attachments)
      .set({
        state: "ready",
        storageKey: permanentKey,
        mediaType: "image/webp",
        byteSize: processed.data.length,
        width: processed.info.width,
        height: processed.info.height,
      })
      .where(
        and(
          eq(attachments.id, attachment.id),
          eq(attachments.state, "pending"),
        ),
      )
      .returning({ id: attachments.id });
    if (!updated) return;
    await transaction
      .update(profiles)
      .set({ avatarUrl })
      .where(eq(profiles.userId, access.user.id));
    await transaction
      .update(users)
      .set({ image: avatarUrl })
      .where(eq(users.id, access.user.id));
  });
  await storage.send(
    new DeleteObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: attachment.storageKey,
    }),
  );
  return Response.json({ avatarUrl }, { headers: privateHeaders });
}
