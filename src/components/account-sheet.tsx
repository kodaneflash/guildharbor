"use client";

import { Drawer } from "@base-ui/react/drawer";
import {
  BadgeDollarSign,
  Mail,
  Menu,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface AccountSheetProps {
  readonly className?: string;
}

interface AccountSheetLink {
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

const accountLinks = [
  { href: "/account", icon: UserRound, label: "Personal account" },
  { href: "/account/orders", icon: ReceiptText, label: "Purchases" },
  { href: "/account/refunds", icon: RotateCcw, label: "Refunds" },
  { href: "/settings/security", icon: ShieldCheck, label: "Account security" },
  { href: "/messages", icon: Mail, label: "Messages" },
  { href: "/affiliate", icon: BadgeDollarSign, label: "Affiliate" },
] as const satisfies readonly AccountSheetLink[];

function isActive(pathname: string, href: string) {
  if (href === "/account") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSheet({ className }: AccountSheetProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <Drawer.Root open={open} onOpenChange={setOpen} swipeDirection="right">
      <Drawer.Trigger
        aria-label="Open account menu"
        className={cn(
          "inline-flex size-10 items-center justify-center rounded-xl text-text-secondary transition hover:bg-panel-strong hover:text-text",
          className,
        )}
      >
        <Menu aria-hidden="true" className="size-5" />
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Backdrop className="account-sheet-backdrop fixed inset-0 z-[70] bg-black/70 backdrop-blur-[2px]" />
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-[71] flex justify-end">
          <Drawer.Popup className="account-sheet-popup pointer-events-auto h-dvh w-[min(100%,28rem)] border-l border-border bg-panel text-text shadow-[var(--shadow-overlay)]">
            <Drawer.Content className="flex h-full flex-col overflow-y-auto px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div>
                  <Drawer.Title className="text-heading-lg text-text">Account</Drawer.Title>
                  <Drawer.Description className="mt-0.5 text-body-sm text-text-muted">
                    Manage your Outlaw activity
                  </Drawer.Description>
                </div>
                <Drawer.Close
                  aria-label="Close account menu"
                  className="inline-flex size-10 items-center justify-center rounded-xl text-text-secondary transition hover:bg-panel-strong hover:text-text"
                >
                  <X aria-hidden="true" className="size-5" />
                </Drawer.Close>
              </div>

              <nav aria-label="Account menu" className="mt-6">
                <ul className="space-y-2">
                  {accountLinks.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;

                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group flex min-h-14 items-center gap-4 rounded-2xl border border-transparent px-4 text-body-md font-medium text-text-secondary transition hover:border-border hover:bg-panel-strong hover:text-text",
                            active && "border-border bg-panel-strong text-text",
                          )}
                          onClick={() => setOpen(false)}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "flex size-10 shrink-0 items-center justify-center rounded-xl bg-panel-raised text-text-muted transition group-hover:text-text",
                              active && "bg-panel text-primary",
                            )}
                          >
                            <Icon className="size-6" strokeWidth={1.8} />
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
