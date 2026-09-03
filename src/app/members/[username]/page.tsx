import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfilePage } from "@/components/profile-page";
import { resolvePublicProfile } from "@/db/resolve-profile";

type MemberPageProps = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: MemberPageProps): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username}'s profile` };
}

export default async function MemberPage({ params }: MemberPageProps) {
  const { username } = await params;
  const profile = await resolvePublicProfile(username);
  if (!profile) notFound();
  return <ProfilePage profile={profile} />;
}
