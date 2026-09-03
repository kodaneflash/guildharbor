import { BellPlus, Eye, Flag, LockKeyhole, MessageCircle, MoveRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { PostCard } from "@/components/post-card";
import { ThreadFlagBadge, ThreadTypeBadge } from "@/components/status-badge";
import { findThread } from "@/data/demo";

type ThreadPageProps = { params: Promise<{ threadId: string; threadSlug: string }> };

export async function generateMetadata({ params }: ThreadPageProps): Promise<Metadata> {
  const { threadId } = await params;
  const thread = findThread(Number(threadId));
  return { title: thread?.title ?? "Thread" };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { threadId, threadSlug } = await params;
  const numericId = Number(threadId);
  if (!Number.isSafeInteger(numericId) || numericId < 1) notFound();
  const thread = findThread(numericId);
  if (!thread) notFound();
  if (thread.id === numericId && thread.slug !== threadSlug) redirect(`/threads/${thread.id}/${thread.slug}`);

  return (
    <div className="site-container space-y-6 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "GuildHarbor", href: "/" }, { label: "Forums", href: "/forums" }, { label: thread.forumSlug, href: `/forums/${thread.forumSlug}` }, { label: "Thread" }]} />
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <ThreadTypeBadge type={thread.type} />
          {thread.badges?.map((badge) => <ThreadFlagBadge key={badge} badge={badge} />)}
        </div>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="max-w-5xl text-2xl font-extrabold leading-tight text-text sm:text-3xl">{thread.title}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
              <span>by <Link href={`/members/${thread.creator}`} className="font-bold text-text-secondary hover:text-category">{thread.creator}</Link></span>
              <span className="inline-flex items-center gap-1"><MessageCircle className="size-3.5" /> {thread.replies.toLocaleString()} replies</span>
              <span className="inline-flex items-center gap-1"><Eye className="size-3.5" /> {thread.views.toLocaleString()} views</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="button-secondary"><BellPlus className="size-4" /> Watch</button>
            <button type="button" className="button-secondary"><Flag className="size-4" /> Report</button>
            <button type="button" className="button-secondary"><LockKeyhole className="size-4" /> Moderate</button>
          </div>
        </div>
      </header>
      <PostCard />
      <PostCard index={2} />
      <section className="surface p-4 sm:p-6" aria-labelledby="reply-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 id="reply-heading" className="font-extrabold text-text">Join the discussion</h2><p className="mt-1 text-sm text-text-muted">Sign in to reply, quote, watch, or leave reputation.</p></div>
          <Link href="/sign-in" className="button-primary">Sign in to reply <MoveRight className="size-4" /></Link>
        </div>
      </section>
    </div>
  );
}
