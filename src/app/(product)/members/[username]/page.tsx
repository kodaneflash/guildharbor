import { communityNotice } from "@/components/access-notice";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfilePage } from "@/components/profile-page";
import { resolvePublicProfile } from "@/db/resolve-profile";
import { requireMember } from "@/lib/session";

type MemberPageProps = { params: Promise<{ username: string }> };

export const metadata: Metadata = { title: "Member profile" };

export default async function MemberPage({ params }: MemberPageProps) {
  const notice = await communityNotice();
  if (notice) return notice;
  const { username } = await params;
  const [access, profile] = await Promise.all([
    requireMember(),
    resolvePublicProfile(username),
  ]);
  if (!profile) notFound();
  return <ProfilePage profile={profile} viewerId={access.user.id} />;
}
