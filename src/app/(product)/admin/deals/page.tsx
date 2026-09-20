import { desc } from "drizzle-orm";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { deals } from "@/db/schema";
export default async function DealOversightPage() { await requirePermission("admin.manage"); const rows = await createReadDatabase().select({ id: deals.id, state: deals.state, updatedAt: deals.updatedAt }).from(deals).orderBy(desc(deals.updatedAt)).limit(100); return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">Pre-funding agreement oversight</h1><p>Metadata only. Private terms and conversation evidence require assignment to a support case. No financial transition is available.</p>{rows.map(row => <p className="surface p-4" key={row.id}>{row.id} · {row.state} · {row.updatedAt.toISOString()}</p>)}{!rows.length && <p>No agreements.</p>}</div>; }
