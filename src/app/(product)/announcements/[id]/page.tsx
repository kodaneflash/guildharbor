import Link from "next/link";
import { notFound } from "next/navigation";
import { AnnouncementCard } from "@/components/announcement-card";
import { findAnnouncement } from "@/domains/announcements/announcement-service";

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const announcement = await findAnnouncement((await params).id);
  if (!announcement) notFound();
  return <div className="site-container max-w-5xl space-y-5 py-8">
    <Link className="text-category hover:underline" href="/announcements">All announcements</Link>
    <h1 className="text-display-sm">Announcement</h1>
    <AnnouncementCard announcement={announcement} linked={false} />
  </div>;
}
