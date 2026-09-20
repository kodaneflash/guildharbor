import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { posts, reports } from "@/db/schema";
import { findThread } from "@/db/queries/community";
import { ReportDecision } from "@/components/report-decision";
export default async function ReportsPage() {
  await requirePermission("moderation.review");
  const database = createReadDatabase();
  const rows = await database.select().from(reports).where(inArray(reports.status, ["open", "triaged"])).orderBy(desc(reports.id)).limit(50);
  const visible = [];
  for (const report of rows) {
    const [post] = report.targetPostId ? await database.select().from(posts).where(eq(posts.id, report.targetPostId)) : [];
    const thread = await findThread(report.targetThreadId ?? post?.threadId ?? 0);
    if (thread) visible.push({ report, thread });
  }
  return <div className="site-container max-w-4xl space-y-5 py-8"><h1 className="text-display-sm font-bold">Community report queue</h1><p>Decisions are audited. Review the context and perform any necessary content moderation before marking a report actioned.</p>{!visible.length && <p className="surface p-6">No accessible community reports awaiting review.</p>}{visible.map(({ report, thread }) => <section key={report.id} className="surface space-y-4 p-5"><Link className="text-category" href={`/threads/${thread.id}/${thread.slug}${report.targetPostId ? `#post-${report.targetPostId}` : ""}`}>Review {thread.title}</Link><p className="whitespace-pre-wrap">{report.reason}</p><p>Status: {report.status}</p><ReportDecision reportId={report.id} /></section>)}</div>;
}
