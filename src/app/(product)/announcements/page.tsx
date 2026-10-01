import Link from "next/link";
import { AnnouncementCard } from "@/components/announcement-card";
import { listAnnouncements } from "@/domains/announcements/announcement-service";
import { pageNumber } from "@/db/queries/community";

export default async function AnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = pageNumber((await searchParams).page);
  const { rows, hasMore } = await listAnnouncements(page);
  return <div className="site-container max-w-5xl space-y-5 py-8">
    <h1 className="text-display-sm">Announcements</h1>
    {rows.map(announcement => <AnnouncementCard key={announcement.id} announcement={announcement} />)}
    {!rows.length && <p className="surface p-6 text-text-muted">No announcements on this page.</p>}
    <nav aria-label="Announcement pagination" className="flex gap-4">
      {page > 1 && <Link className="button-secondary" href={`?page=${page - 1}`}>Previous</Link>}
      {hasMore && <Link className="button-secondary" href={`?page=${page + 1}`}>Next</Link>}
    </nav>
  </div>;
}
