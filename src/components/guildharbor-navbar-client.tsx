"use client";

import { Bell, ChevronDown, Menu, MessageCircleMore, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  isNavigationItemActive,
  navigationGroups,
  type NavigationGroup,
  type NavigationItem,
} from "@/components/navigation-config";
import { cn } from "@/lib/utils";

interface NavbarAccount {
  readonly admin: boolean;
  readonly cartCount: number;
  readonly username: string;
}

interface GuildHarborNavbarClientProps {
  readonly account?: NavbarAccount | null;
  readonly isAuthenticated: boolean;
  readonly signOutAction?: () => Promise<void>;
}

export function GuildHarborNavbarClient({
  account = null,
  isAuthenticated,
  signOutAction,
}: GuildHarborNavbarClientProps) {
  const pathname = usePathname();
  const [mobileMenuPath, setMobileMenuPath] = useState<string | null>(null);
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const [desktopMenu, setDesktopMenu] = useState<{
    id: string;
    path: string;
  } | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const desktopTriggerRefs = useRef(new Map<string, HTMLButtonElement>());

  const mobileOpen = mobileMenuPath === pathname;
  const activeDesktopMenu = desktopMenu?.path === pathname ? desktopMenu.id : null;

  useEffect(() => {
    if (!mobileOpen && !activeDesktopMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      setDesktopMenu(null);
      setMobileMenuPath(null);
      setMobileGroup(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeDesktopMenu, mobileOpen]);

  const closeMenus = () => {
    setDesktopMenu(null);
    setMobileMenuPath(null);
    setMobileGroup(null);
  };

  const handleEscape = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;

    if (activeDesktopMenu) {
      event.preventDefault();
      setDesktopMenu(null);
      desktopTriggerRefs.current.get(activeDesktopMenu)?.focus();
      return;
    }

    if (mobileOpen) {
      event.preventDefault();
      closeMenus();
      mobileButtonRef.current?.focus();
    }
  };

  return (
    <header
      ref={headerRef}
      className="gh-navbar fixed inset-x-0 top-0 z-50 px-3 pt-3 text-[#fafafa]"
      onKeyDown={handleEscape}
    >
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#090a0b] via-[#090a0b]/85 to-transparent backdrop-blur-[2px]" />
      <div className="relative mx-auto max-w-[620px] rounded-2xl border border-white/[0.08] bg-[#1a1a1a]/85 px-5 shadow-2xl shadow-black/35 ring-1 ring-black/40 backdrop-blur-xl lg:px-2">
        <div className="relative flex min-h-14 flex-wrap items-center justify-between lg:min-h-[52px]">
          <Wordmark className="lg:hidden" />

          <button
            ref={mobileButtonRef}
            type="button"
            aria-controls="guildharbor-mobile-navigation"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            className="inline-flex size-10 items-center justify-center rounded-lg text-zinc-200 transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6] lg:hidden"
            onClick={() => {
              setMobileMenuPath(mobileOpen ? null : pathname);
              if (mobileOpen) setMobileGroup(null);
            }}
          >
            {mobileOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
          </button>

          <nav aria-label="Primary navigation" className="hidden w-full items-center justify-center lg:flex">
            <Link
              href="/"
              aria-label="GuildHarbor home"
              aria-current={pathname === "/" ? "page" : undefined}
              className="mr-1 inline-flex size-9 items-center justify-center rounded-md transition hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]"
              onClick={closeMenus}
            >
              <Image src="/guildharbor-mark.svg" alt="" width={32} height={20} className="h-6 w-auto" priority />
            </Link>

            {navigationGroups.map((group) => (
              <DesktopGroup
                key={group.id}
                group={group}
                isOpen={activeDesktopMenu === group.id}
                pathname={pathname}
                registerTrigger={(node) => {
                  if (node) desktopTriggerRefs.current.set(group.id, node);
                  else desktopTriggerRefs.current.delete(group.id);
                }}
                onClose={closeMenus}
                onToggle={() =>
                  setDesktopMenu(
                    activeDesktopMenu === group.id
                      ? null
                      : { id: group.id, path: pathname },
                  )
                }
              />
            ))}

          </nav>

          {mobileOpen && (
            <div id="guildharbor-mobile-navigation" className="w-full border-t border-white/[0.08] pb-5 pt-2 lg:hidden">
              <nav aria-label="Mobile navigation">
                {navigationGroups.map((group) => {
                  const open = mobileGroup === group.id;
                  return (
                    <div key={group.id} className="border-b border-white/[0.08]">
                      <button
                        type="button"
                        aria-controls={`mobile-nav-${group.id}`}
                        aria-expanded={open}
                        className="flex min-h-14 w-full items-center justify-between rounded-md px-1 text-left text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]"
                        onClick={() => setMobileGroup(open ? null : group.id)}
                      >
                        {group.label}
                        <ChevronDown aria-hidden="true" className={cn("size-4 transition", open && "rotate-180")} />
                      </button>
                      {open && (
                        <ul id={`mobile-nav-${group.id}`} className="space-y-1 pb-4">
                          {group.items.map((item) => (
                            <li key={item.href}>
                              <MenuItem item={item} pathname={pathname} onClick={closeMenus} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
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

function DesktopGroup({
  group,
  isOpen,
  pathname,
  registerTrigger,
  onClose,
  onToggle,
}: {
  group: NavigationGroup;
  isOpen: boolean;
  pathname: string;
  registerTrigger: (node: HTMLButtonElement | null) => void;
  onClose: () => void;
  onToggle: () => void;
}) {
  const active = group.items.some((item) => isNavigationItemActive(pathname, item.href));
  return (
    <div className="relative">
      <button
        ref={registerTrigger}
        type="button"
        id={`nav-trigger-${group.id}`}
        aria-controls={`nav-menu-${group.id}`}
        aria-expanded={isOpen}
        className={cn(
          "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]",
          (active || isOpen) && "bg-white/[0.06] text-white",
        )}
        onClick={onToggle}
      >
        {group.label}
        <ChevronDown aria-hidden="true" className={cn("size-3.5 transition", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div
          id={`nav-menu-${group.id}`}
          aria-labelledby={`nav-trigger-${group.id}`}
          className="absolute left-1/2 top-[calc(100%+14px)] w-[330px] -translate-x-1/2 rounded-xl border border-black/5 bg-white p-2 text-zinc-900 shadow-2xl ring-1 ring-black/5"
        >
          <p className="px-2 pb-1 pt-1 text-xs font-medium text-zinc-500">{group.label}</p>
          <ul className="space-y-1">
            {group.items.map((item) => (
              <li key={item.href}>
                <MenuItem item={item} pathname={pathname} onClick={onClose} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MenuItem({ item, pathname, onClick }: { item: NavigationItem; pathname: string; onClick: () => void }) {
  const active = isNavigationItemActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "grid grid-cols-[38px_1fr] gap-3 rounded-lg p-2 text-zinc-900 transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f766e]",
        active && "bg-zinc-100",
      )}
      onClick={onClick}
    >
      <span aria-hidden="true" className="relative flex size-9 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-zinc-900/10 before:absolute before:-inset-x-1 before:-inset-y-2 before:border-x before:border-dashed before:border-zinc-900/10">
        <Icon className="size-4 stroke-zinc-800" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{item.label}</span>
        <span className="mt-0.5 block text-xs leading-4 text-zinc-500">{item.description}</span>
      </span>
    </Link>
  );
}

function AccountControls({ account, isAuthenticated, signOutAction, onNavigate, mobile = false }: GuildHarborNavbarClientProps & { onNavigate: () => void; mobile?: boolean }) {
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
            <Link href="/sign-up" className="nav-primary-button" onClick={onNavigate}>Join GuildHarbor</Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="absolute right-10 top-[20px] hidden items-center gap-3 lg:flex">
      {isAuthenticated ? (
        <>
          {account && <Link href="/cart" aria-label={`Cart, ${account.cartCount} items`} className="nav-icon-button"><ShoppingCart aria-hidden="true" className="size-4" /><span className="text-[11px]">{account.cartCount}</span></Link>}
          {account && <Link href="/notifications" aria-label="Notifications" className="nav-icon-button"><Bell aria-hidden="true" className="size-4" /></Link>}
          {account && <Link href="/messages" aria-label="Messages" className="nav-icon-button"><MessageCircleMore aria-hidden="true" className="size-4" /></Link>}
          <Link href="/account" className="nav-primary-button" onClick={onNavigate}>{account?.username ?? "Account"}</Link>
        </>
      ) : (
        <>
          <Link href="/sign-in" className="text-sm font-semibold text-zinc-400 transition hover:text-white">Log in</Link>
          <Link href="/sign-up" className="nav-primary-button">Join GuildHarbor</Link>
        </>
      )}
    </div>
  );
}

function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="GuildHarbor home" className={cn("items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14b8a6]", className)}>
      <Image src="/guildharbor-mark.svg" alt="" width={38} height={23} className="h-7 w-auto" priority />
      <span className="text-[13px] font-semibold tracking-[0.17em] text-zinc-200">GUILDHARBOR</span>
    </Link>
  );
}
