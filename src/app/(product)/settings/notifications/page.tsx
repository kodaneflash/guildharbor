import { eq } from "drizzle-orm";
import { requireMember } from "@/lib/session";
import { createReadDatabase } from "@/db/client";
import { notificationPreferences } from "@/db/schema";
import { NotificationPreferences } from "@/components/notification-preferences";
import { SettingsNav } from "@/components/settings-nav";
export default async function PreferencesPage() { const access = await requireMember(); const preferences = await createReadDatabase().select().from(notificationPreferences).where(eq(notificationPreferences.userId, access.user.id)); return <div className="site-container py-8"><div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]"><SettingsNav active="notifications" /><div className="max-w-3xl space-y-5"><h1 className="text-display-sm font-bold">Notification preferences</h1><NotificationPreferences preferences={preferences} /></div></div></div>; }
