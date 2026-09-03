import { sql } from "drizzle-orm";
import { after } from "next/server";
import { z } from "zod";

import { createReadDatabase } from "@/db/client";
import { threadViewBuckets } from "@/db/schema";
import { isDatabaseConfigured } from "@/lib/env";

const inputSchema = z.object({ threadId: z.number().int().positive() }).strict();
export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid thread view" }, { status: 400 });
  if (isDatabaseConfigured) after(async () => { const database = createReadDatabase(); const day = new Date().toISOString().slice(0, 10); await database.insert(threadViewBuckets).values({ threadId: parsed.data.threadId, day, viewCount: 1 }).onConflictDoUpdate({ target: [threadViewBuckets.threadId, threadViewBuckets.day], set: { viewCount: sql`${threadViewBuckets.viewCount} + 1` } }); });
  return new Response(null, { status: 202 });
}
