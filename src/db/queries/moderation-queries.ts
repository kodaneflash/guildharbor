import "server-only";
import { requirePermission } from "@/lib/session";

import { asc, desc, eq } from "drizzle-orm";

import type { ReadDatabase } from "@/db/client";
import { reports } from "@/db/schema";

export async function listOpenReports(database: ReadDatabase, limit = 50) {
  await requirePermission("moderation.review");
  return database
    .select({
      id: reports.id,
      category: reports.category,
      reason: reports.reason,
      status: reports.status,
      priority: reports.priority,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.status, "open"))
    .orderBy(desc(reports.priority), asc(reports.createdAt), asc(reports.id))
    .limit(Math.min(limit, 100));
}
