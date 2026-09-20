import { authorizeFileResource } from "@/domains/delivery/file-service";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createReadDatabase } from "@/db/client";
import { attachments, profiles } from "@/db/schema";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { createObjectStorageClient } from "@/lib/storage";
import { env } from "@/lib/env";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  const id = z.uuid().safeParse((await params).id);
  if (!id.success)
    return new Response(null, { status: 404, headers: privateHeaders });
  // Only the currently assigned avatar is readable. Quarantine and unrelated uploads are never served.
  const [attachment] = await createReadDatabase()
    .select({ storageKey: attachments.storageKey })
    .from(attachments)
    .innerJoin(
      profiles,
      and(
        eq(profiles.userId, attachments.ownerId),
        eq(profiles.avatarUrl, `/api/files/${id.data}`),
      ),
    )
    .where(
      and(
        eq(attachments.id, id.data),
        eq(attachments.state, "ready"),
        eq(attachments.purpose, "avatar"),
      ),
    )
    .limit(1);
  if (!attachment) {
    const [file] = await createReadDatabase().select().from(attachments).where(and(eq(attachments.id, id.data), eq(attachments.state, "ready"), eq(attachments.scanStatus, "clean")));
    if (!file?.resourceId || !(await authorizeFileResource(file.purpose, file.resourceId, false))) return new Response(null, { status: 404, headers: privateHeaders });
    const object = await createObjectStorageClient().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: file.storageKey }));
    if (!object.Body) return new Response(null, { status: 404, headers: privateHeaders });
    const preview = new URL(request.url).searchParams.get("preview") === "1" && ["text/plain", "image/webp"].includes(file.mediaType);
    return new Response(object.Body.transformToWebStream(), { headers: { ...privateHeaders, "Content-Type": file.mediaType, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Content-Disposition": `${preview ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName ?? "download")}` } });
  }
  const object = await createObjectStorageClient().send(
    new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: attachment.storageKey }),
  );
  if (!object.Body)
    return new Response(null, { status: 404, headers: privateHeaders });
  return new Response(object.Body.transformToWebStream(), {
    headers: {
      ...privateHeaders,
      "Content-Type": "image/webp",
      "Content-Disposition": "inline",
    },
  });
}
