import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { renderRichText } from "@/components/rich-text-content";
import type { threadPosts } from "@/db/queries/community";
export function PostCard({
  post,
}: {
  post: Awaited<ReturnType<typeof threadPosts>>[number];
}) {
  return (
    <article id={`post-${post.id}`} className="surface overflow-hidden">
      <div className="grid md:grid-cols-[238px_minmax(0,1fr)]">
        <aside className="border-b border-border bg-panel-raised p-5 md:border-b-0 md:border-r">
          <UserAvatar
            seed={post.username ?? "?"}
            src={post.avatarUrl ?? undefined}
            size="lg"
          />
          <Link
            href={`/members/${post.username}`}
            className="mt-3 block text-lg font-extrabold"
          >
            {post.username ?? "Deleted member"}
          </Link>
          <dl className="mt-4 space-y-2 text-xs text-text-muted">
            <div>Posts: {post.postCount ?? 0}</div>
            <div>Threads: {post.threadCount ?? 0}</div>
            <div>
              Joined:{" "}
              {post.joinedAt.toLocaleDateString("en-US", { timeZone: "UTC" })}
            </div>
          </dl>
        </aside>
        <div className="min-w-0 p-5 sm:p-7">
          <header className="flex justify-between gap-3 border-b border-border pb-4 text-xs text-text-muted">
            <time dateTime={post.createdAt.toISOString()}>
              {post.createdAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC
            </time>
            <a href={`#post-${post.id}`}>#{post.id}</a>
          </header>
          <div className="prose-forum break-words py-6">
            {renderRichText(post.content)}
          </div>
          {post.editedAt && (
            <p className="text-xs text-text-muted">
              Edited{" "}
              {post.editedAt.toLocaleString("en-US", { timeZone: "UTC" })} UTC
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
