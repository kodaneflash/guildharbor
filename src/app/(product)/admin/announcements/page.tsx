import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { pageNumber } from "@/db/queries/community";
import { listAnnouncements } from "@/domains/announcements/announcement-service";
import { AnnouncementAdminForm, AnnouncementRemovalForm } from "@/components/announcement-admin-form";

export default async function AdminAnnouncementsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("admin.manage");
  const page = pageNumber((await searchParams).page);
  const { rows, hasMore } = await listAnnouncements(page);
  return <div className="site-container max-w-4xl space-y-5 py-8">
    <h1 className="text-display-sm">Announcement administration</h1>
    <h2 className="text-heading-lg">Publish announcement</h2>
    <AnnouncementAdminForm id={randomUUID()} />
    <h2 className="text-heading-lg">Published announcements</h2>
    {!rows.length && <p className="text-text-muted">No announcements on this page.</p>}
    {rows.map(row => <details key={row.id} className="surface overflow-hidden">
      <summary className="cursor-pointer p-5 font-semibold">{row.title}{row.pinned ? " · Pinned" : ""}{row.important ? " · Important" : ""}</summary>
      <AnnouncementAdminForm id={row.id} value={{ title: row.title, content: row.content, pinned: row.pinned, important: row.important }} />
      <AnnouncementRemovalForm id={row.id} />
    </details>)}
    <nav aria-label="Announcement administration pagination" className="flex gap-4">
      {page > 1 && <Link className="button-secondary" href={`?page=${page - 1}`}>Previous</Link>}
      {hasMore && <Link className="button-secondary" href={`?page=${page + 1}`}>Next</Link>}
    </nav>
  </div>;
}
