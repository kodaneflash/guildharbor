"use client";

import { Bell, Compass, Mail, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AccountSheet } from "@/components/account-sheet";
import {
  isNavigationItemActive,
  navigationItems,
  type NavigationItem,
} from "@/components/navigation-config";
import { cn } from "@/lib/utils";

interface NavbarAccount {
  readonly admin: boolean;
  readonly cartCount: number;
  readonly unreadCount: number;
  readonly username: string;
}

interface OutlawNavbarClientProps {
  readonly account?: NavbarAccount | null;
  readonly isAuthenticated: boolean;
  readonly signOutAction?: () => Promise<void>;
}

export function OutlawNavbarClient({
  account = null,
  isAuthenticated,
  signOutAction,
}: OutlawNavbarClientProps) {
  const pathname = usePathname();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  const mobileOpen = mobileMenuPath === pathname;

  useEffect(() => {
    if (!mobileOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setMobileMenuPath(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mobileOpen]);

  const closeMenus = () => {
    setMobileMenuPath(null);
  };

  const handleEscape = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;

    if (mobileOpen) {
      event.preventDefault();
      closeMenus();
      mobileButtonRef.current?.focus();
    }
  };

  return (
    <header
      ref={headerRef}
      className="gh-navbar fixed inset-x-0 top-0 z-50 px-3 pt-3 text-text"
      onKeyDown={handleEscape}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-page via-page/85 to-transparent backdrop-blur-[2px]" />
      <div className="relative mx-auto max-w-[620px] rounded-2xl border border-border bg-panel/95 px-5 shadow-[var(--shadow-overlay)] backdrop-blur-xl lg:px-2">
        <div className="relative flex min-h-14 flex-wrap items-center justify-between lg:min-h-[52px]">
          <Wordmark className="lg:hidden" />

          <div className="flex items-center gap-1 lg:hidden">
            <button
              ref={mobileButtonRef}
              type="button"
              aria-controls="outlaw-mobile-navigation"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              className="inline-flex size-10 items-center justify-center rounded-xl text-text-secondary transition hover:bg-panel-strong hover:text-text"
              onClick={() => {
                setMobileMenuPath(mobileOpen ? null : pathname);
              }}
            >
              {mobileOpen ? <X aria-hidden="true" className="size-5" /> : <Compass aria-hidden="true" className="size-5" />}
            </button>
            <AccountSheet />
          </div>

          <nav aria-label="Primary navigation" className="hidden w-full items-center justify-center lg:flex">
            {navigationItems.map((item) => (
              <PrimaryNavLink key={item.href} item={item} pathname={pathname} onClick={closeMenus} />
            ))}

          </nav>

          {mobileOpen && (
            <div id="outlaw-mobile-navigation" className="w-full border-t border-border pb-5 pt-2 lg:hidden">
              <nav aria-label="Mobile navigation">
                <ul className="divide-y divide-border">
                  {navigationItems.map((item) => (
                    <li key={item.href}>
                      <PrimaryNavLink item={item} pathname={pathname} onClick={closeMenus} mobile />
                    </li>
                  ))}
                </ul>
              </nav>
              <AccountControls
                account={account}
                isAuthenticated={isAuthenticated}
                signOutAction={signOutAction}
                onNavigate={closeMenus}
                mobile
              />
            </div>
          )}
        </div>
      </div>

      <Wordmark className="absolute left-10 top-[26px] hidden lg:inline-flex" />
      <AccountControls
        account={account}
        isAuthenticated={isAuthenticated}
        signOutAction={signOutAction}
        onNavigate={closeMenus}
      />
    </header>
  );
}

function PrimaryNavLink({ item, pathname, onClick, mobile = false }: { item: NavigationItem; pathname: string; onClick: () => void; mobile?: boolean }) {
  const active = isNavigationItemActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-xl px-3 text-body-sm font-medium text-text-secondary transition hover:bg-panel-strong hover:text-text",
        active && "bg-panel-strong text-text",
        mobile && "h-14 w-full px-1 text-lg",
      )}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}

function AccountControls({ account, isAuthenticated, signOutAction, onNavigate, mobile = false }: OutlawNavbarClientProps & { onNavigate: () => void; mobile?: boolean }) {
  if (mobile) {
    return (
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {isAuthenticated ? (
          <>
            <Link href="/account" className="nav-secondary-button" onClick={onNavigate}>Account{account ? ` · ${account.username}` : ""}</Link>
            <Link href="/notifications" className="nav-secondary-button" onClick={onNavigate}>Notifications</Link>
            <Link href="/messages" className="nav-secondary-button" onClick={onNavigate}>Messages</Link>
            {account?.admin && <Link href="/admin" className="nav-secondary-button" onClick={onNavigate}>Administration</Link>}
            {signOutAction && <form action={signOutAction}><button className="nav-secondary-button w-full" type="submit">Log out</button></form>}
          </>
        ) : (
          <>
            <Link href="/sign-in" className="nav-secondary-button" onClick={onNavigate}>Log in</Link>
            <Link href="/sign-up" className="nav-primary-button" onClick={onNavigate}>Join Outlaw</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="absolute right-10 top-[20px] hidden items-center gap-3 lg:flex">
      {isAuthenticated ? (
        <>
          <Link href="/messages" aria-label="Messages" className="nav-icon-button"><Mail aria-hidden="true" className="size-4" strokeWidth={1.6} /></Link>
          <Link href="/notifications" aria-label={account?.unreadCount ? `Notifications, ${account.unreadCount} unread` : "Notifications"} className="nav-icon-button">
            <Bell aria-hidden="true" className="size-4" strokeWidth={1.6} />
            {account && account.unreadCount > 0 && <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-medium text-black">{account.unreadCount > 99 ? "99+" : account.unreadCount}</span>}
          </Link>
          <Link href="/cart" aria-label={`Cart, ${account?.cartCount ?? 0} items`} className="nav-icon-button">
            <ShoppingCart aria-hidden="true" className="size-4" strokeWidth={1.6} />
            {account && account.cartCount > 0 && <span aria-hidden="true" className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-medium text-black">{account.cartCount > 99 ? "99+" : account.cartCount}</span>}
          </Link>
        </>
      ) : (
        <>
          <Link href="/sign-in" className="text-body-sm font-medium text-text-secondary transition hover:text-text">Log in</Link>
          <Link href="/sign-up" className="nav-primary-button">Join Outlaw</Link>
        </>
      )}
      <AccountSheet className="size-9" />
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Outlaw home" className={cn("items-center gap-2 rounded-xl", className)}>
      <span className="text-[13px] font-medium tracking-[0.12em] text-text-secondary">OUTLAW</span>
    </Link>
  );
}
