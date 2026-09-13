import { eq } from "drizzle-orm";
import { communityNotice } from "@/components/access-notice";
import { SettingsNav } from "@/components/settings-nav";
import { AvatarUpload } from "@/components/avatar-upload";
import { ProfileForm } from "@/components/profile-form";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { profiles } from "@/db/schema";
export default async function ProfileSettingsPage() {
  const notice = await communityNotice();
  if (notice) return notice;
  const access = await requireMember();
  const [profile] = await createReadDatabase()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, access.user.id))
    .limit(1);
  if (!profile) throw new Error("Account profile is missing.");
  return (
    <div className="site-container py-8">
      <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <SettingsNav active="profile" />
        <div className="max-w-3xl space-y-5">
          <h1 className="text-3xl font-extrabold">Profile settings</h1>
          <p className="text-text-muted">
            Your profile is visible to community members.
          </p>
          <AvatarUpload
            username={access.user.username!}
            avatarUrl={profile.avatarUrl ?? undefined}
          />
          <ProfileForm
            displayName={profile.displayName || access.user.username!}
            telegramHandle={profile.telegramHandle ?? ""}
            bio={profile.bio}
          />
        </div>
      </div>
    </div>
  );
}
