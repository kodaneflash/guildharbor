import "server-only";

import { desc, eq } from "drizzle-orm";

import type { ReadDatabase } from "@/db/client";
import { reputationEvents, vouches } from "@/db/schema";

export async function listReputation(database: ReadDatabase, recipientId: string, limit = 30) {
  return database.select().from(reputationEvents).where(eq(reputationEvents.recipientId, recipientId)).orderBy(desc(reputationEvents.id)).limit(Math.min(limit, 50));
}

export async function listVouches(database: ReadDatabase, recipientId: string, limit = 30) {
  return database.select().from(vouches).where(eq(vouches.recipientId, recipientId)).orderBy(desc(vouches.id)).limit(Math.min(limit, 50));
}
