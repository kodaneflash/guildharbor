import { pageNumber } from "@/db/queries/community";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { supportCases } from "@/db/schema";
import { SupportForm } from "@/components/support-forms";
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ deal?: string; conversation?: string; page?: string }> }) { const session = await requireSession(); const search = await searchParams; const page = pageNumber(search.page); const rows = await createReadDatabase().select().from(supportCases).where(eq(supportCases.creatorId, session.user.id)).orderBy(desc(supportCases.updatedAt), desc(supportCases.id)).limit(50).offset((page - 1) * 50); return <div className="site-container max-w-3xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Support</h1><p>Support cases persist in your account. No live-chat response time is promised. Unfunded cases do not freeze funds or initiate refunds.</p><SupportForm dealId={search.deal} conversationId={search.conversation} /><h2 className="text-heading-lg font-bold">Your cases</h2>{!rows.length && <p>No support cases yet.</p>}{rows.map(record => <Link className="surface block p-4" key={record.id} href={`/support/cases/${record.id}`}>{record.subject} · {record.status}</Link>)}<nav className="flex gap-4" aria-label="Support case pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}{rows.length === 50 && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></div>; }
