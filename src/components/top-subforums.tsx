import Link from "next/link";
import type { topSubforums } from "@/db/queries/community";

export function TopSubforums({ forums }: { forums: Awaited<ReturnType<typeof topSubforums>> }) {
  return <section className="surface space-y-4 p-5" aria-labelledby="top-subforums-heading">
    <h2 id="top-subforums-heading" className="font-bold">Top subforums</h2>
    {forums.length ? <ul className="space-y-3">{forums.map(forum => <li key={forum.id} className="min-w-0"><Link className="break-words text-body-sm font-semibold text-category" href={`/forums/${forum.slug}`}>{forum.title}</Link><p className="text-body-xs text-text-muted">{forum.discussionCount} {forum.discussionCount === 1 ? "discussion" : "discussions"}</p></li>)}</ul> : <p className="text-body-sm text-text-muted">No discussions in your available forums yet. Visit the forum to start a conversation.</p>}
    <Link className="inline-block text-body-sm text-category" href="/forums">Explore all forums →</Link>
  </section>;
}
