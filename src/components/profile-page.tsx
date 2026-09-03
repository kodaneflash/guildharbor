import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  Flag,
  HeartHandshake,
  History,
  Info,
  ScanLine,
  Send,
  ShieldPlus,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { UserAvatar } from "@/components/user-avatar";
import type { ProfileSummary } from "@/lib/domain-types";
import { cn } from "@/lib/utils";

const badgeIcons = { BadgeCheck, Trophy, HeartHandshake, Sparkles };

const profileTabs = [
  ["Overview", ""],
  ["Threads", "/threads"],
  ["Posts", "/posts"],
  ["Reputation", "/reputation"],
  ["Vouches", "/vouches"],
  ["Listings", "/listings"],
  ["Scan", "/scan"],
] as const;

export function ProfilePage({ profile, section = "Overview" }: { profile: ProfileSummary; section?: string }) {
  return (
    <div className="site-container space-y-6 py-8 sm:py-10">
      <Breadcrumbs items={[{ label: "GuildHarbor", href: "/" }, { label: "Members" }, { label: profile.username }]} />

      <section className="relative min-h-[230px] overflow-hidden rounded-lg border border-border bg-panel">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(3,255,237,.18),transparent_28%),radial-gradient(circle_at_75%_0%,rgba(249,19,190,.14),transparent_30%),linear-gradient(125deg,#16272a,#201a27_55%,#211b17)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative flex min-h-[230px] flex-col justify-end gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="flex items-end gap-4 sm:gap-6">
            <UserAvatar seed={profile.avatarSeed} src={profile.avatarUrl} eager size="xl" className="border-4 border-panel shadow-[0_0_0_1px_var(--border)]" />
            <div className="min-w-0 pb-2">
              <div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-3xl font-black text-white sm:text-4xl">{profile.displayName}</h1><BadgeCheck className="size-6 fill-cyan text-page" aria-label="Verified member" /></div>
              <p className="mt-2 text-sm font-semibold text-text-secondary">{profile.tagline}</p>
              {profile.telegram && <p className="mt-1 text-xs text-category">{profile.telegram}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <button className="button-secondary" type="button"><ShieldPlus className="size-4" /> Rep</button>
            <button className="button-secondary" type="button"><HeartHandshake className="size-4" /> Vouch</button>
            <Link className="button-secondary" href={`/members/${profile.username}/scan`}><ScanLine className="size-4" /> Scan</Link>
            <button className="button-secondary" type="button"><Flag className="size-4" /> Report</button>
            <Link className="button-secondary col-span-2" href="/messages"><Send className="size-4" /> Message</Link>
          </div>
        </div>
      </section>

      <nav aria-label="Profile sections" className="flex gap-1 overflow-x-auto rounded-md border border-border bg-panel p-1.5">
        {profileTabs.map(([label, suffix]) => (
          <Link key={label} href={`/members/${profile.username}${suffix}`} className={cn("shrink-0 rounded-[5px] px-3 py-2 text-xs font-bold text-text-muted hover:bg-panel-raised hover:text-text", section === label && "bg-panel-strong text-text")}>{label}</Link>
        ))}
      </nav>

      {section === "Overview" ? <ProfileOverview profile={profile} /> : <ProfileSection profile={profile} section={section} />}
    </div>
  );
}

function ProfileOverview({ profile }: { profile: ProfileSummary }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)_310px]">
      <aside className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={profile.reputation.toLocaleString()} label="Reputation" accent />
          <StatCard value={profile.vouches.positive.toLocaleString()} label="Vouches" accent />
        </div>
        <InfoRow icon={Clock3} label="Status" value={profile.lastSeen} />
        <InfoRow icon={UserRound} label="UID" value={profile.uid} />
        <InfoRow icon={CalendarDays} label="Join date" value={profile.joined} />
        <InfoRow icon={History} label="Username history" value="0" />
        <div className="surface p-5">
          <h2 className="text-sm font-extrabold text-text">Awards</h2>
          <div className="mt-4 grid grid-cols-4 gap-3">
            {profile.badges.map((badge) => {
              const Icon = badgeIcons[badge.icon as keyof typeof badgeIcons] ?? BadgeCheck;
              return <div key={badge.label} title={badge.label} className={cn("grid aspect-square place-items-center rounded-md border border-border bg-page", `text-${badge.tone}`)}><Icon className="size-5" /><span className="sr-only">{badge.label}</span></div>;
            })}
          </div>
        </div>
      </aside>

      <div className="space-y-5">
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
          <StatCard value={profile.threads.toLocaleString()} label="Threads" compact />
          <StatCard value={profile.posts.toLocaleString()} label="Posts" compact />
          <StatCard value={profile.likes.toLocaleString()} label="Likes" compact />
          <StatCard value={profile.credits.toLocaleString()} label="Credits" compact />
        </div>
        <section className="surface p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-text">Groups</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {profile.groups.map((group) => <div key={group.name} className="min-h-28 rounded-md border border-border bg-page p-4"><span className={cn("text-xs font-black uppercase tracking-[0.1em]", `text-${group.tone}`)}>{group.name}</span><p className="mt-3 text-xs leading-5 text-text-muted">{group.subtitle}</p></div>)}
          </div>
        </section>
        <section className="surface overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-lg font-extrabold text-text">Market</h2>
          {profile.listings.map((listing) => <Link key={listing.title} href="/marketplace" className="grid gap-1 border-b border-border px-5 py-4 last:border-0 hover:bg-panel-raised sm:grid-cols-[1fr_180px]"><span className="font-semibold text-text-secondary"><strong className="mr-2 text-trust">{listing.status}</strong>{listing.title}</span><span className="text-xs text-text-muted sm:text-right">{listing.category}</span></Link>)}
        </section>
        <section className="surface p-5 sm:p-6"><h2 className="text-lg font-extrabold text-text">About</h2><p className="mt-4 text-sm leading-7 text-text-secondary">{profile.about}</p></section>
        <section className="surface p-5 sm:p-6"><h2 className="text-lg font-extrabold text-text">Signature</h2><blockquote className="mt-4 border-l-2 border-category pl-4 text-sm italic leading-7 text-text-secondary">{profile.signature}</blockquote></section>
      </div>

      <aside className="space-y-4">
        <div className="surface flex items-center gap-3 p-5"><span className="grid size-11 place-items-center rounded-full bg-trust/15 text-lg font-black text-trust">{profile.years}</span><div><strong className="block text-sm uppercase text-text">Years of service</strong><span className="text-xs text-text-muted">Longstanding member</span></div></div>
        <div className="surface flex items-center gap-3 p-5"><BadgeCheck className="size-6 fill-cyan text-page" /><strong className="text-sm uppercase text-text">Verified member</strong></div>
        <section className="surface overflow-hidden"><h2 className="border-b border-border px-5 py-4 text-lg font-extrabold text-text">Latest activity</h2>{profile.activity.map((item) => <Link key={item.title} href={item.href} className="block border-b border-border px-5 py-4 last:border-0 hover:bg-panel-raised"><strong className="block text-sm text-text-secondary">{item.title}</strong><span className="mt-1 block text-xs text-text-muted">{item.detail}</span></Link>)}</section>
      </aside>
    </div>
  );
}

function ProfileSection({ profile, section }: { profile: ProfileSummary; section: string }) {
  if (section === "Scan") {
    return <section className="surface p-5 sm:p-7"><div className="flex items-start gap-4"><ScanLine className="mt-1 size-6 text-cyan" /><div><h2 className="text-xl font-extrabold text-text">Internal trust scan</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">This report contains GuildHarbor activity only. It does not verify identity, payment ability, or off-platform conduct.</p></div></div><dl className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><ScanItem label="Account age" value={`${profile.years} years`} /><ScanItem label="Reputation" value={`${profile.reputation.toLocaleString()} positive`} /><ScanItem label="Vouches" value={`${profile.vouches.positive.toLocaleString()} positive`} /><ScanItem label="Username history" value="No changes" /><ScanItem label="Active warnings" value="None" /><ScanItem label="Completed listings" value="42" /></dl></section>;
  }

  return <section className="surface min-h-72 p-5 sm:p-7"><h2 className="text-xl font-extrabold text-text">{section}</h2><p className="mt-2 text-sm text-text-muted">Public {section.toLowerCase()} for {profile.username}, ordered by newest activity.</p><div className="mt-6 rounded-md border border-dashed border-border-strong bg-page p-10 text-center"><Info className="mx-auto size-6 text-text-muted" /><p className="mt-3 text-sm text-text-muted">The live database will populate this cursor-paginated section.</p></div></section>;
}

function StatCard({ value, label, accent = false, compact = false }: { value: string; label: string; accent?: boolean; compact?: boolean }) {
  return <div className={cn("bg-panel-raised text-center", compact ? "px-3 py-5" : "rounded-md border border-border px-3 py-5")}><strong className={cn("block text-2xl font-black", accent ? "text-trust" : "text-text")}>{value}</strong><span className="mt-1 block text-xs font-semibold text-text-muted">{label}</span></div>;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <div className="surface flex min-h-14 items-center gap-3 px-4"><Icon className="size-4 text-text-muted" /><span className="text-xs font-semibold text-text-muted">{label}</span><strong className="ml-auto text-right text-xs text-text-secondary">{value}</strong></div>;
}

function ScanItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-border bg-page p-4"><dt className="text-xs font-semibold text-text-muted">{label}</dt><dd className="mt-2 font-bold text-text-secondary">{value}</dd></div>;
}
