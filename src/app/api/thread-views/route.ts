import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { memberApiAccess, privateHeaders } from "@/lib/api-access";
import { findThread } from "@/db/queries/community";
import { createReadDatabase } from "@/db/client";
import { threads } from "@/db/schema";
import { enforceRateLimit } from "@/lib/rate-limit";
export async function POST(request: Request) {
  const access = await memberApiAccess(request);
  if (access instanceof Response) return access;
  const parsed = z
    .object({ threadId: z.number().int().positive() })
    .strict()
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: "Invalid thread view." },
      { status: 400, headers: privateHeaders },
    );
  const thread = await findThread(parsed.data.threadId);
  if (!thread)
    return new Response(null, { status: 404, headers: privateHeaders });
  await enforceRateLimit("search", access.user.id);
  await createReadDatabase()
    .update(threads)
    .set({ viewCount: sql`${threads.viewCount} + 1` })
    .where(eq(threads.id, thread.id));
  return new Response(null, { status: 204, headers: privateHeaders });
}
