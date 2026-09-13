import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  HeartHandshake,
  Send,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { renderRichText } from "@/components/rich-text-content";
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
] as const;

export function ProfilePage({ profile }: { profile: ProfileSummary }) {
  return (
    <div className="site-container space-y-6 py-8 sm:py-10">
      <Breadcrumbs
        items={[
          { label: "GuildHarbor", href: "/" },
          { label: "Members", href: "/members" },
          { label: profile.username },
        ]}
      />

      <section className="relative min-h-[230px] overflow-hidden rounded-lg border border-border bg-panel">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(3,255,237,.18),transparent_28%),radial-gradient(circle_at_75%_0%,rgba(249,19,190,.14),transparent_30%),linear-gradient(125deg,#16272a,#201a27_55%,#211b17)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] [background-size:32px_32px]" />
        <div className="relative flex min-h-[230px] flex-col justify-end gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-8">
          <div className="flex items-end gap-4 sm:gap-6">
            <UserAvatar
              seed={profile.avatarSeed}
              src={profile.avatarUrl}
              eager
              size="xl"
              className="border-4 border-panel shadow-[0_0_0_1px_var(--border)]"
            />
            <div className="min-w-0 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-3xl font-black text-white sm:text-4xl">
                  {profile.displayName}
                </h1>
                <BadgeCheck
                  className="size-6 fill-cyan text-page"
                  aria-label="Verified member"
                />
              </div>
              <p className="mt-2 text-sm font-semibold text-text-secondary">
                {profile.tagline}
              </p>
              {profile.telegram && (
                <p className="mt-1 text-xs text-category">{profile.telegram}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Link className="button-secondary col-span-2" href="/messages">
              <Send className="size-4" /> Message
            </Link>
          </div>
        </div>
      </section>

      <nav
        aria-label="Profile sections"
        className="flex gap-1 overflow-x-auto rounded-md border border-border bg-panel p-1.5"
      >
        {profileTabs.map(([label, suffix]) => (
          <Link
            key={label}
            href={`/members/${profile.username}${suffix}`}
            className={cn(
              "shrink-0 rounded-[5px] px-3 py-2 text-xs font-bold text-text-muted hover:bg-panel-raised hover:text-text",
              label === "Overview" && "bg-panel-strong text-text",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ProfileOverview profile={profile} />
    </div>
  );
}

function ProfileOverview({ profile }: { profile: ProfileSummary }) {
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)_310px]">
      <aside className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            value={profile.reputation.toLocaleString()}
            label="Reputation"
            accent
          />
          <StatCard
            value={profile.vouches.positive.toLocaleString()}
            label="Vouches"
            accent
          />
        </div>
        <InfoRow icon={Clock3} label="Status" value={profile.lastSeen} />
        <InfoRow icon={UserRound} label="UID" value={profile.uid} />
        <InfoRow icon={CalendarDays} label="Join date" value={profile.joined} />
        <div className="surface p-5">
          <h2 className="text-sm font-extrabold text-text">Awards</h2>
          {!profile.badges.length && (
            <p className="mt-3 text-xs text-text-muted">No awards yet.</p>
          )}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {profile.badges.map((badge) => {
              const Icon =
                badgeIcons[badge.icon as keyof typeof badgeIcons] ?? BadgeCheck;
              return (
                <div
                  key={badge.label}
                  title={badge.label}
                  className={cn(
                    "grid aspect-square place-items-center rounded-md border border-border bg-page",
                    `text-${badge.tone}`,
                  )}
                >
                  <Icon className="size-5" />
                  <span className="sr-only">{badge.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="space-y-5">
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-border sm:grid-cols-4">
          <StatCard
            value={profile.threads.toLocaleString()}
            label="Threads"
            compact
          />
          <StatCard
            value={profile.posts.toLocaleString()}
            label="Posts"
            compact
          />
          <StatCard
            value={profile.likes.toLocaleString()}
            label="Likes"
            compact
          />
          <StatCard
            value={profile.credits.toLocaleString()}
            label="Credits"
            compact
          />
        </div>
        <section className="surface p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-text">Groups</h2>
          {!profile.groups.length && (
            <p className="mt-3 text-sm text-text-muted">No groups.</p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {profile.groups.map((group) => (
              <div
                key={group.name}
                className="min-h-28 rounded-md border border-border bg-page p-4"
              >
                <span
                  className={cn(
                    "text-xs font-black uppercase tracking-[0.1em]",
                    `text-${group.tone}`,
                  )}
                >
                  {group.name}
                </span>
                <p className="mt-3 text-xs leading-5 text-text-muted">
                  {group.subtitle}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="surface p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-text">About</h2>
          <p className="mt-4 text-sm leading-7 text-text-secondary">
            {profile.about || "No biography provided."}
          </p>
        </section>
        <section className="surface p-5 sm:p-6"><h2 className="text-lg font-extrabold text-text">Signature</h2><div className="prose-forum mt-4">{renderRichText(profile.signature)}</div></section>
      </div>

      <aside className="space-y-4">
        <div className="surface flex items-center gap-3 p-5">
          <span className="grid size-11 place-items-center rounded-full bg-trust/15 text-lg font-black text-trust">
            {profile.years}
          </span>
          <div>
            <strong className="block text-sm uppercase text-text">
              Years of service
            </strong>
            <span className="text-xs text-text-muted">
              Community membership
            </span>
          </div>
        </div>
        <div className="surface flex items-center gap-3 p-5">
          <BadgeCheck className="size-6 fill-cyan text-page" />
          <strong className="text-sm uppercase text-text">
            Verified member
          </strong>
        </div>
        <section className="surface overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-lg font-extrabold text-text">
            Latest activity
          </h2>
          {!profile.activity.length && (
            <p className="p-5 text-sm text-text-muted">No recent activity.</p>
          )}
          {profile.activity.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="block border-b border-border px-5 py-4 last:border-0 hover:bg-panel-raised"
            >
              <strong className="block text-sm text-text-secondary">
                {item.title}
              </strong>
              <span className="mt-1 block text-xs text-text-muted">
                {item.detail}
              </span>
            </Link>
          ))}
        </section>
      </aside>
    </div>
  );
}

function StatCard({
  value,
  label,
  accent = false,
  compact = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-panel-raised text-center",
        compact ? "px-3 py-5" : "rounded-md border border-border px-3 py-5",
      )}
    >
      <strong
        className={cn(
          "block text-2xl font-black",
          accent ? "text-trust" : "text-text",
        )}
      >
        {value}
      </strong>
      <span className="mt-1 block text-xs font-semibold text-text-muted">
        {label}
      </span>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="surface flex min-h-14 items-center gap-3 px-4">
      <Icon className="size-4 text-text-muted" />
      <span className="text-xs font-semibold text-text-muted">{label}</span>
      <strong className="ml-auto text-right text-xs text-text-secondary">
        {value}
      </strong>
    </div>
  );
}
