import { LockKeyhole, Pin } from "lucide-react";

import type { ThreadBadge, ThreadType } from "@/lib/domain-types";
import { cn } from "@/lib/utils";

const typeStyles: Record<ThreadType, string> = {
  discussion: "border-border-strong bg-panel-strong text-text-secondary",
  announcement: "border-cyan/40 bg-cyan text-page-deep",
};

const badgeStyles: Record<ThreadBadge, string> = {
  Trending: "border-sticky/40 bg-sticky text-page-deep",
  Premium: "border-pink/35 bg-pink/15 text-pink",
  Mentor: "border-cyan/35 bg-cyan/15 text-cyan",
  Locked: "border-danger/35 bg-danger/15 text-danger",
};

export function ThreadTypeBadge({ type }: { type: ThreadType }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-[5px] border px-1.5 text-[11px] font-extrabold capitalize leading-none",
        typeStyles[type],
      )}
    >
      {type}
    </span>
  );
}

export function ThreadFlagBadge({ badge }: { badge: ThreadBadge }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-[5px] border px-1.5 text-[11px] font-extrabold uppercase leading-none",
        badgeStyles[badge],
      )}
    >
      {badge === "Locked" && <LockKeyhole className="size-3" />}
      {badge}
    </span>
  );
}

export function PinnedBadge() {
  return <Pin className="size-4 fill-sticky text-sticky" aria-label="Pinned" />;
}
