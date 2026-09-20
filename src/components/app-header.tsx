"use client";

import {
  Bell,
  Home,
  ShoppingCart,
  Handshake,
  Store,
  Menu,
  MessageCircleMore,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

import { BrandMark } from "@/components/brand-mark";
import { authClient } from "@/lib/auth-client";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

const mainLinks = [
  { href: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { href: "/forums", label: "Forum", icon: Home },
  { href: "/sellers", label: "Sellers", icon: Store },
  { href: "/deals", label: "Deals", icon: Handshake },
] as const;

export function AppHeader({
  account,
  signedIn,
  cartCount = 0,
}: {
  signedIn: boolean;
  cartCount?: number;
  account: { username: string; avatarUrl?: string; admin: boolean } | null;
}) {
  const pathname = usePathname();
  const navigationButton = useRef<HTMLButtonElement>(null);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const isOpen = openPath === pathname;

  return (
    <header onKeyDown={event => { if (event.key === "Escape" && isOpen) { setOpenPath(null); navigationButton.current?.focus(); } }} className="sticky top-0 z-50 border-b border-border/70 bg-page/95 backdrop-blur-xl">
      <div className="header-container relative flex h-[86px] items-center justify-between gap-4">
        <nav
          aria-label="Primary"
          className="hidden items-center rounded-[26px] border border-border bg-panel px-2 py-2 xl:flex"
        >
          {mainLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-[20px] px-3 text-body-sm font-semibold text-text-secondary transition-colors hover:bg-panel-raised hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                  isActive && "bg-page-deep text-text",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>

        <BrandMark compact className="absolute left-1/2 -translate-x-1/2 xl:static xl:translate-x-0" />

        <nav
          aria-label="Account"
          className="hidden items-center gap-1.5 xl:flex"
        >
          {account ? (
            <>
              <Link href="/cart" className="icon-link" aria-label={`Cart, ${cartCount} items`}><ShoppingCart className="size-5" aria-hidden="true" /><span className="text-body-xs">{cartCount}</span></Link>
              <Link
                href="/notifications"
                className="icon-link"
                aria-label="Notifications"
              >
                <Bell className="size-[19px]" aria-hidden="true" />
              </Link>
              <Link
                href="/messages"
                className="icon-link relative"
                aria-label="Messages"
              >
                <MessageCircleMore className="size-5" aria-hidden="true" />
              </Link>
              <Link
                href="/account"
                className="ml-2 inline-flex items-center gap-2 rounded-[24px] border border-border bg-panel px-3 py-2 text-body-sm font-bold text-text hover:border-border-strong"
              >
                <UserAvatar
                  seed={account.username}
                  src={account.avatarUrl}
                  size="sm"
                />
                <span className="max-w-32 truncate">{account.username}</span>
              </Link>
              {account.admin && (
                <Link href="/admin" className="header-link">
                  Administration
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
          ref={navigationButton}
          type="button"
          aria-controls="mobile-navigation"
          className="icon-link ml-auto xl:!hidden"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          onClick={() => setOpenPath(isOpen ? null : pathname)}
        >
          {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {isOpen && (
        <div id="mobile-navigation" className="border-t border-border bg-panel p-3 xl:hidden">
          <nav
            aria-label="Mobile primary"
            className="site-container grid grid-cols-2 gap-2"
          >
            {account && <Link className="header-link" href="/cart">Cart ({cartCount})</Link>}
            {account && <Link className="header-link" href="/account">Your account</Link>}
            {mainLinks.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-page px-3 text-body-sm font-semibold text-text-secondary"
              >
                <Icon className="size-4" aria-hidden="true" /> {label}
              </Link>
            ))}
            <Link
              href="/notifications"
              className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-page px-3 text-body-sm font-semibold text-text-secondary"
            >
              <Bell className="size-4" aria-hidden="true" /> Notifications
            </Link>
            <Link
              href="/messages"
              className="flex min-h-12 items-center gap-3 rounded-md border border-border bg-page px-3 text-body-sm font-semibold text-text-secondary"
            >
              <MessageCircleMore className="size-4" aria-hidden="true" /> Messages
            </Link>
            <Link href="/settings/profile" className="header-link">
              Settings
            </Link>
            {account?.admin && (
              <Link href="/admin" className="header-link">
                Administration
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
              <><Link href="/sign-in" className="header-link">Log in</Link><Link href="/sign-up" className="header-link">Register</Link></>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
