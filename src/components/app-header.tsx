"use client";

import {
  Bell,
  Coins,
  Compass,
  Home,
  Menu,
  MessageCircleMore,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const mainLinks = [
  { href: "/forums", label: "Browse", icon: Home },
  { href: "/members", label: "Members", icon: ShieldCheck },
  { href: "/search", label: "Search", icon: Search },
] as const;

export function AppHeader({
  account,
  signedIn,
}: {
  signedIn: boolean;
  account: { username: string; avatarUrl?: string; admin: boolean } | null;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const isOpen = openPath === pathname;

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-page/95 backdrop-blur-xl">
      <div className="site-container relative flex h-[86px] items-center justify-between gap-4">
        <nav
          aria-label="Primary"
          className="hidden items-center rounded-[26px] border border-border bg-panel px-2 py-2 lg:flex"
        >
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-[20px] px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-panel-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  isActive && "bg-page-deep text-text",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
          <span className="mx-1 h-5 w-px bg-border" />
          <Link
            href="/settings/security"
            className="icon-link"
            aria-label="Account security"
          >
            <Coins className="size-[18px]" />
          </Link>
        </nav>

        <BrandMark compact className="absolute left-1/2 -translate-x-1/2" />

        <nav
          aria-label="Account"
          className="hidden items-center gap-1.5 lg:flex"
        >
          {account ? (
            <>
              <Link href="/forums" className="header-link">
                <Compass className="size-4" /> Explore
              </Link>
              <Link
                href="/notifications"
                className="icon-link"
                aria-label="Notifications"
              >
                <Bell className="size-[19px]" />
              </Link>
              <Link
                href="/messages"
                className="icon-link relative"
                aria-label="Messages"
              >
                <MessageCircleMore className="size-5" />
              </Link>
              <Link
                href={`/members/${account.username}`}
                className="ml-2 inline-flex items-center gap-2 rounded-[24px] border border-border bg-panel px-3 py-2 text-sm font-bold text-text hover:border-border-strong"
              >
                <UserAvatar
                  seed={account.username}
                  src={account.avatarUrl}
                  size="sm"
                />
                {account.username}
              </Link>
              {account.admin && (
                <Link href="/admin/registrations" className="header-link">
                  Registrations
                </Link>
              )}
              <button
                className="header-link"
                onClick={async () => {
                  await authClient.signOut();
                  window.location.assign("/");
                }}
              >
                Log out
              </button>
            </>
          ) : signedIn ? (
            <button
              className="header-link"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign("/");
              }}
            >
              Log out
            </button>
          ) : (
            <>
              <Link href="/sign-in" className="header-link">
                Log in
              </Link>
              <Link href="/sign-up" className="header-link">
                Register
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          className="icon-link ml-auto lg:!hidden"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          onClick={() => setOpenPath(isOpen ? null : pathname)}
        >
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {isOpen && (
        <div className="border-t border-border bg-panel p-3 lg:hidden">
          <nav
            aria-label="Mobile primary"
            className="site-container grid grid-cols-2 gap-2"
          >
            {mainLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-page px-4 text-sm font-semibold text-text-secondary"
              >
                <Icon className="size-4" /> {label}
              </Link>
            ))}
            <Link
              href="/notifications"
              className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-page px-4 text-sm font-semibold text-text-secondary"
            >
              <Bell className="size-4" /> Notifications
            </Link>
            <Link
              href="/messages"
              className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-page px-4 text-sm font-semibold text-text-secondary"
            >
              <MessageCircleMore className="size-4" /> Messages
            </Link>
            <Link href="/settings/profile" className="header-link">
              Settings
            </Link>
            {account?.admin && (
              <Link href="/admin/registrations" className="header-link">
                Registrations
              </Link>
            )}
            {signedIn ? (
              <button
                className="header-link"
                onClick={async () => {
                  await authClient.signOut();
                  window.location.assign("/");
                }}
              >
                Log out
              </button>
            ) : (
              <Link href="/sign-in" className="header-link">
                Log in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
