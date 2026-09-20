import { and, eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { caseDetails, caseEvidence } from "@/domains/support/support-service";
import { attachments } from "@/db/schema";
import { createReadDatabase } from "@/db/client";
import { createObjectStorageClient } from "@/lib/storage";
import { env } from "@/lib/env";
export async function GET(request: Request, { params }: { params: Promise<{ caseId: string; fileId: string }> }) {
  const access = await memberApiAccess(request); if (access instanceof Response) return access;
  const { caseId, fileId } = await params; if (!z.uuid().safeParse(caseId).success || !z.uuid().safeParse(fileId).success) return new Response(null, { status: 404, headers: privateHeaders });
  const details = await caseDetails(caseId); if (!details?.staff || !details.record.conversationId) return new Response(null, { status: 404, headers: privateHeaders });
  const [file] = await createReadDatabase().select().from(attachments).where(and(eq(attachments.id, fileId), eq(attachments.purpose, "conversation"), eq(attachments.resourceId, details.record.conversationId), eq(attachments.state, "ready"), eq(attachments.scanStatus, "clean")));
  if (!file) return new Response(null, { status: 404, headers: privateHeaders });
  await caseEvidence(caseId);
  const object = await createObjectStorageClient().send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: file.storageKey })); if (!object.Body) return new Response(null, { status: 404, headers: privateHeaders });
  return new Response(object.Body.transformToWebStream(), { headers: { ...privateHeaders, "Content-Type": file.mediaType, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName ?? "evidence")}` } });
}
