import { Bell, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { PinnedBadge, ThreadFlagBadge, ThreadTypeBadge } from "@/components/status-badge";
import { UserAvatar } from "@/components/user-avatar";
import type { ThreadListItem } from "@/lib/domain-types";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("en-US");

export function ThreadRow({ thread }: { thread: ThreadListItem }) {
  return (
    <article className={cn("thread-row group", thread.isUnread && "before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:bg-category")}>
      <UserAvatar seed={thread.avatarSeed} src={thread.avatarUrl} />
      <div className="min-w-0 py-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {thread.isPinned && <PinnedBadge />}
          <ThreadTypeBadge type={thread.type} />
          {thread.badges?.map((badge) => <ThreadFlagBadge key={badge} badge={badge} />)}
          <Link
            href={`/threads/${thread.id}/${thread.slug}`}
            className={cn(
              "min-w-0 text-[15px] font-bold leading-5 text-text decoration-category/60 underline-offset-4 group-hover:text-category group-hover:underline sm:text-base",
              thread.isUnread && "text-white",
            )}
          >
            {thread.title}
          </Link>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
          by <Link href={`/members/${thread.creator}`} className="font-semibold hover:text-text" style={{ color: thread.creatorAccent }}>{thread.creator}</Link>
          <span aria-hidden="true">·</span>
          <span className="md:hidden">{numberFormatter.format(thread.replies)} replies</span>
          {thread.isSubscribed && <Bell className="size-3 text-yellow" aria-label="Subscribed" />}
          {thread.badges?.includes("Mentor") && <ShieldCheck className="size-3 text-cyan" aria-label="Mentor" />}
        </p>
      </div>
      <div className="hidden h-full items-center justify-center border-l border-border/60 text-center md:flex">
        <div>
          <MessageCircle className="mx-auto mb-1 size-3.5 text-text-muted" />
          <strong className="text-sm text-text-secondary">{numberFormatter.format(thread.replies)}</strong>
          <span className="sr-only"> replies</span>
        </div>
      </div>
      <div className="col-span-2 flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-xs md:col-span-1 md:block md:h-full md:border-l md:border-t-0 md:px-4 md:pt-4 md:text-center">
        <span className="font-semibold text-text-secondary">{thread.latestReplyAt}</span>
        <span className="block truncate text-text-muted md:mt-1">by {thread.latestReplier}</span>
      </div>
    </article>
  );
}
