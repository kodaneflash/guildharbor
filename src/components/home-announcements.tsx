import { AnnouncementCard } from "@/components/announcement-card";
import { listAnnouncements } from "@/domains/announcements/announcement-service";

export async function HomeAnnouncements() {
  const { rows } = await listAnnouncements(1, 3);
  if (!rows.length) return null;
  return <section aria-labelledby="announcements-heading" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="announcements-heading" className="flex items-center gap-3 text-heading-xl">Announcements<span aria-hidden="true" className="size-2.5 rounded-full bg-trust" /></h2>
    </div>
    {rows.map(announcement => <AnnouncementCard key={announcement.id} announcement={announcement} headingLevel={3} />)}
  </section>;
}
