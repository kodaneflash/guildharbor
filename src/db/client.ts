import "server-only";

import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as createHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as createTransactionalDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";

function requireDatabaseUrl() {
  if (!env.DATABASE_URL) {
    throw new Error("Database access requires DATABASE_URL");
  }

  return env.DATABASE_URL;
}

export function createReadDatabase() {
  const client = neon(requireDatabaseUrl());
  return createHttpDatabase({ client, schema });
}

export function createTransactionPool() {
  return new Pool({ connectionString: requireDatabaseUrl() });
}

export function createTransactionDatabase(pool: Pool) {
  return createTransactionalDatabase({ client: pool, schema });
}

export type ReadDatabase = ReturnType<typeof createReadDatabase>;
export type TransactionDatabase = ReturnType<typeof createTransactionDatabase>;
