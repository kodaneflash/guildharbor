import Image from "next/image";
import Link from "next/link";
import { Pin } from "lucide-react";
import type { announcements } from "@/db/schema";
import { renderRichText } from "@/components/rich-text-content";

export function AnnouncementCard({ announcement, linked = true, headingLevel = 2 }: {
  announcement: typeof announcements.$inferSelect;
  linked?: boolean;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  return <article className="surface min-w-0 space-y-5 rounded-3xl p-5 sm:p-7">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full border border-border bg-page sm:size-14">
          <Image src="/outlaw-mark.svg" alt="" width={32} height={32} />
        </span>
        <div><p className="text-heading-md">Outlaw Team</p>
          <time className="text-body-sm text-text-muted" dateTime={announcement.publishedAt.toISOString()}>
            {announcement.publishedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}
          </time>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {announcement.pinned && <span className="inline-flex items-center gap-1 rounded-lg bg-panel-raised px-3 py-1 text-body-sm text-text-secondary"><Pin aria-hidden="true" className="size-4" />Pinned</span>}
        {announcement.important && <span className="rounded-lg bg-danger/15 px-3 py-1 text-body-sm text-orange">Important</span>}
      </div>
    </header>
    <div className="space-y-3">
      <Heading className="break-words text-heading-xl">{linked ? <Link className="hover:underline" href={`/announcements/${announcement.id}`}>{announcement.title}</Link> : announcement.title}</Heading>
      <div className="announcement-content">{renderRichText(announcement.content)}</div>
    </div>
  </article>;
}
