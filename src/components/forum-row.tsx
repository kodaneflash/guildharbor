import {
  BriefcaseBusiness,
  Globe2,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  PackageOpen,
} from "lucide-react";
import Link from "next/link";

import type { ForumSummary } from "@/lib/domain-types";

const icons = {
  BriefcaseBusiness,
  Globe2,
  LifeBuoy,
  Megaphone,
  MessagesSquare,
  PackageOpen,
};

export function ForumRow({ forum }: { forum: ForumSummary }) {
  const Icon = icons[forum.icon as keyof typeof icons] ?? MessagesSquare;

  return (
    <article className="forum-row">
      <span
        className="grid size-11 shrink-0 place-items-center rounded-md border border-border bg-page"
        style={{ color: forum.accent }}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <Link
          href={`/forums/${forum.slug}`}
          className="text-base font-bold text-text hover:text-category hover:underline hover:underline-offset-4"
        >
          {forum.name}
        </Link>
        <p className="mt-1 text-xs leading-5 text-text-muted sm:text-[13px]">
          {forum.description}
        </p>
        {forum.subforums && (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-text-secondary">
            {forum.subforums.map((subforum) => (
              <span key={subforum}>› {subforum}</span>
            ))}
          </div>
        )}
      </div>
      <div className="hidden text-center lg:block">
        <strong className="block text-sm text-text-secondary">
          {forum.threadCount.toLocaleString()}
        </strong>
        <span className="text-[11px] text-text-muted">Threads</span>
      </div>
      <div className="hidden text-center lg:block">
        <strong className="block text-sm text-text-secondary">
          {forum.postCount.toLocaleString()}
        </strong>
        <span className="text-[11px] text-text-muted">Posts</span>
      </div>
    </article>
  );
}
