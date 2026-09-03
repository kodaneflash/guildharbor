import { notFound } from "next/navigation";

import { ProfilePage } from "@/components/profile-page";
import { resolvePublicProfile } from "@/db/resolve-profile";

const sections: Record<string, string> = {
  threads: "Threads",
  posts: "Posts",
  reputation: "Reputation",
  vouches: "Vouches",
  listings: "Listings",
  scan: "Scan",
  activity: "Activity",
  about: "About",
};

export default async function MemberSectionPage({ params }: { params: Promise<{ username: string; section: string }> }) {
  const { username, section } = await params;
  const title = sections[section];
  if (!title) notFound();
  const profile = await resolvePublicProfile(username);
  if (!profile) notFound();
  return <ProfilePage profile={profile} section={title} />;
}
