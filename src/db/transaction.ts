import "server-only";

import { createTransactionDatabase, createTransactionPool, type TransactionDatabase } from "@/db/client";

type DatabaseTransaction = Parameters<Parameters<TransactionDatabase["transaction"]>[0]>[0];

export async function withTransaction<T>(operation: (database: DatabaseTransaction) => Promise<T>) {
  const pool = createTransactionPool();
  const database = createTransactionDatabase(pool);
  try {
    return await database.transaction(async (transaction) => operation(transaction));
  } finally {
    await pool.end();
  }
}
