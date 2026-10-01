import Link from "next/link";
import { requireMember } from "@/lib/session";
import { resolvePublicProfile } from "@/db/resolve-profile";
import { telegramEvents, telegramState } from "@/domains/notifications/telegram";
import { TelegramAccount } from "@/components/telegram-account";
import { env } from "@/lib/env";
export default async function AccountPage() {
  const access = await requireMember();
  const telegramAvailable = Boolean(env.TELEGRAM_NOTIFICATIONS_ENABLED && env.TELEGRAM_BOT_USERNAME && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BRIDGE_SECRET);
  const [profile, telegram] = await Promise.all([access.user.username ? resolvePublicProfile(access.user.username) : null, telegramAvailable ? telegramState(access.user.id) : Promise.resolve({ connected: false, preferences: telegramEvents.map(event => ({ ...event, enabled: true })) })]);
  return <div className="site-container max-w-4xl space-y-6 py-8"><h1 className="text-display-sm">Your account</h1><section className="surface space-y-3 p-6"><h2 className="text-heading-lg">{profile?.displayName ?? access.user.name}</h2><p className="break-all">Verified email: {access.user.email}</p>{profile && <><p>Member since {profile.joined}</p><p>{profile.threads} visible threads · {profile.posts} visible posts</p></>}<p className="text-text-muted">Community feedback is separate from verified marketplace transactions. Payments and the production wallet are not available yet.</p></section><nav aria-label="Your account" className="grid gap-3 sm:grid-cols-2">{[["/cart", "Your cart"], ["/account/favorites", "Favorites"], ["/account/orders", "Orders"], ["/seller", "Seller workspace"], ["/escrow", "Agreements"], ["/support", "Support"], ["/settings/profile", "Profile and preferences"], ["/settings/security", "Account security"], ["/messages", "Messages"], ["/notifications", "Notifications"]].map(([href, label]) => <Link key={href} className="surface p-5 hover:bg-panel-raised" href={href}>{label}</Link>)}<TelegramAccount initial={telegram} available={telegramAvailable} /></nav></div>;
}
