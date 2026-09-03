import { GetObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";

import { env, isR2Configured } from "@/lib/env";
import { createObjectStorageClient } from "@/lib/storage";

const fileSchema = z.string().regex(/^[a-z0-9-]+\.webp$/);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
) {
  if (!isR2Configured) return new Response(null, { status: 404 });

  const parsedFile = fileSchema.safeParse((await params).file);
  if (!parsedFile.success) return new Response(null, { status: 404 });

  try {
    const object = await createObjectStorageClient().send(
      new GetObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: `demo/avatars/${parsedFile.data}`,
      }),
    );
    if (!object.Body) return new Response(null, { status: 404 });

    return new Response(Buffer.from(await object.Body.transformToByteArray()), {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
        "Content-Length": String(object.ContentLength ?? 0),
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
