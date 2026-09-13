import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { communityNotice } from "@/components/access-notice";
import { PostCard } from "@/components/post-card";
import { findThread, threadPosts, pageNumber } from "@/db/queries/community";
import { ReplyForm } from "@/components/reply-form";
export const metadata = { title: "Thread" };
export default async function ThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ threadId: string; threadSlug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const notice = await communityNotice();
  if (notice) return notice;
  const { threadId, threadSlug } = await params;
  const id = Number(threadId);
  if (!Number.isSafeInteger(id) || id < 1) notFound();
  const thread = await findThread(id);
  if (!thread) notFound();
  if (thread.slug !== threadSlug)
    redirect(`/threads/${thread.id}/${thread.slug}`);
  const page = pageNumber((await searchParams).page);
  const posts = await threadPosts(id, page);
  return (
    <div className="site-container space-y-6 py-8">
      <h1 className="text-3xl font-extrabold">{thread.title}</h1>
      <p className="text-xs text-text-muted">{thread.replyCount} replies</p>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      {!posts.length && <p className="surface p-6">No posts on this page.</p>}
      <nav className="flex gap-3" aria-label="Pagination">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {posts.length === 30 && <Link href={`?page=${page + 1}`}>Next</Link>}
      </nav>
      {thread.status === "open" ? (
        <ReplyForm threadId={id} />
      ) : (
        <p className="surface p-6 text-text-muted">
          This thread is closed to replies.
        </p>
      )}
    </div>
  );
}
