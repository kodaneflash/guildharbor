import { notFound } from "next/navigation";
import { postHistory } from "@/domains/thread/forum-operations";
import { renderRichText } from "@/components/rich-text-content";
import { viewerTimezone } from "@/lib/viewer-timezone";
export default async function PostHistoryPage({ params }: { params: Promise<{ postId: string }> }) {
  const id = Number((await params).postId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const history = await postHistory(id);
  if (!history) notFound();
  const timeZone = await viewerTimezone();
  return <div className="site-container space-y-5 py-8"><h1 className="text-display-sm font-bold">Post edit history</h1>{!history.length && <p>No edits recorded.</p>}{history.map(entry => <section key={entry.id} className="surface space-y-4 p-5"><p>{entry.createdAt.toLocaleString("en-US", { timeZone })} — {entry.reason}</p><h2 className="font-bold">Before</h2><div className="prose-forum">{renderRichText(entry.previousContent)}</div><h2 className="font-bold">After</h2><div className="prose-forum">{renderRichText(entry.newContent)}</div></section>)}</div>;
}
