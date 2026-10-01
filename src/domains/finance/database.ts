import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** Shared PostgreSQL query surface: production Neon and disposable integration
 * databases run the same services. Callers must supply an open transaction. */
export type FinanceTransaction = Pick<PgDatabase<PgQueryResultHKT>, "select" | "insert" | "update" | "delete" | "execute">;
