import { ResourceUpload } from "./resource-upload";
import { ResourceFiles } from "./resource-files";
import { PostControls } from "@/components/forum-controls";
import { requireMember } from "@/lib/session";
import { viewerTimezone } from "@/lib/viewer-timezone";
import Link from "next/link";
import { UserAvatar } from "@/components/user-avatar";
import { renderRichText } from "@/components/rich-text-content";
import type { threadPosts } from "@/db/queries/community";
export async function PostCard({
  post,
  threadOpen,
}: {
  post: Awaited<ReturnType<typeof threadPosts>>[number];
  threadOpen: boolean;
}) {
  const timeZone = await viewerTimezone();
  const access = await requireMember();
  const moderator = access.permissions.some(permission => ["admin.manage", "forum.moderate"].includes(permission));
  const canEdit = moderator || (threadOpen && post.authorId === access.user.id && access.permissions.includes("thread.edit.own"));
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
            className="mt-3 block text-heading-md font-extrabold"
          >
            {post.username ?? "Deleted member"}
          </Link>
          <dl className="mt-4 space-y-2 text-body-xs text-text-muted">
            <div>
              Joined:{" "}
              {post.joinedAt.toLocaleDateString("en-US", { timeZone })}
            </div>
          </dl>
        </aside>
        <div className="min-w-0 p-5 sm:p-7">
          <header className="flex justify-between gap-3 border-b border-border pb-4 text-body-xs text-text-muted">
            <time dateTime={post.createdAt.toISOString()}>
              {post.createdAt.toLocaleString("en-US", { timeZone })} {timeZone}
            </time>
            <a href={`#post-${post.id}`}>#{post.id}</a>
          </header>
          <div className="prose-forum break-words py-6">
            {renderRichText(post.content)}
          </div>
          {post.editedAt && (
            <p className="text-body-xs text-text-muted">
              Edited{" "}
              {post.editedAt.toLocaleString("en-US", { timeZone })} {timeZone}
            </p>
          )}
          <ResourceFiles purpose="post" resourceId={String(post.id)} />
          {threadOpen && post.authorId === access.user.id && <ResourceUpload purpose="post" resourceId={String(post.id)} />}
          <PostControls threadId={post.threadId} postId={post.id} text={post.plainText} updatedAt={post.updatedAt.toISOString()} canEdit={canEdit} />
        </div>
      </div>
    </article>
  );
}
