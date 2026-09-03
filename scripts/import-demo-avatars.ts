import { PutObjectCommand } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";

import { env, isR2Configured } from "@/lib/env";
import { createObjectStorageClient } from "@/lib/storage";

const scrapedProfileSchema = z.object({
  profiles: z.array(z.object({
    alias: z.string().regex(/^[A-Za-z][A-Za-z0-9]{1,29}$/),
    avatarUrl: z.string().url(),
  }).passthrough()),
}).passthrough();

if (!isR2Configured) throw new Error("R2 is not configured");

const sourcePath = path.resolve(".demo-cache/oguser-profiles.json");
const source = scrapedProfileSchema.parse(JSON.parse(await readFile(sourcePath, "utf8")));
const storage = createObjectStorageClient();

for (const profile of source.profiles) {
  const response = await fetch(profile.avatarUrl, {
    headers: { "User-Agent": "GuildHarborDemoImporter/1.0" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Avatar download failed for ${profile.alias}`);

  const sourceImage = Buffer.from(await response.arrayBuffer());
  if (sourceImage.byteLength > 10 * 1024 * 1024) throw new Error(`Avatar is too large for ${profile.alias}`);

  const avatar = await sharp(sourceImage, { failOn: "error", limitInputPixels: 20_000_000 })
    .rotate()
    .resize(384, 384, { fit: "cover", position: "attention" })
    .webp({ quality: 86 })
    .toBuffer();

  await storage.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET,
    Key: `demo/avatars/${profile.alias.toLocaleLowerCase()}.webp`,
    Body: avatar,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable",
    Metadata: { purpose: "pseudonymized-demo-avatar" },
  }));
}

console.info(`Imported ${source.profiles.length} sanitized demo avatars`);
