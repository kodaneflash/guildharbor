import { createHash } from "node:crypto";
import { z } from "zod";

export interface QueryDatabase {
  query<T extends Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
}
const row = z.record(z.string(), z.unknown());
export const snapshotSchema = z.object({
  version: z.literal(1),
  tables: z.record(z.string(), z.array(row)),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function quoteIdentifier(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
export async function publicTables(database: QueryDatabase) {
  const result = await database.query<{ name: string }>("SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  return result.rows.map(({ name }) => name);
}
export async function captureSnapshot(database: QueryDatabase): Promise<Snapshot> {
  const tables: Snapshot["tables"] = {};
  for (const name of await publicTables(database)) {
    const result = await database.query<{ record: Record<string, unknown> }>(`SELECT to_jsonb(t) AS record FROM public.${quoteIdentifier(name)} t ORDER BY to_jsonb(t)::text`);
    tables[name] = result.rows.map(({ record }) => record);
  }
  return { version: 1, tables, sha256: digest(JSON.stringify(tables)) };
}
export function verifySnapshot(value: unknown): Snapshot {
  const parsed = snapshotSchema.parse(value);
  if (digest(JSON.stringify(parsed.tables)) !== parsed.sha256) throw new Error("Preservation snapshot checksum mismatch");
  return parsed;
}
export function requirePreservation(current: Snapshot, preserved: Snapshot | undefined, privateForumPending: boolean) {
  if (!privateForumPending || !Object.values(current.tables).some(rows => rows.length > 0)) return;
  if (!preserved) throw new Error("Populated database before 0002: a verified preservation snapshot and restore rehearsal are required");
  if (current.sha256 !== verifySnapshot(preserved).sha256) throw new Error("Database changed since preservation; pause writes and capture a new verified snapshot");
}
