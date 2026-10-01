"use client";

import { House, Store, ReceiptText, Wallet, Users, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { bottomNavigationItems, isNavigationItemActive, sidebarItems } from "@/components/navigation-config";
import { cn } from "@/lib/utils";

const icons = { home: House, market: Store, orders: ReceiptText, wallet: Wallet, referrals: Users, forum: MessagesSquare };
type ProductNavigationItem = { readonly href: string; readonly label: string; readonly icon: keyof typeof icons };

export function ProductNavigation() {
  const pathname = usePathname();
  return <>
    <aside className="fixed bottom-0 left-0 top-[76px] z-40 hidden w-52 overflow-y-auto border-r border-border bg-page px-3 py-6 lg:block">
      <nav aria-label="Sidebar navigation">
        <NavigationLinks items={sidebarItems} pathname={pathname} />
      </nav>
    </aside>
    <nav aria-label="Bottom navigation" className="product-bottom-navigation fixed inset-x-0 bottom-0 z-40 rounded-t-3xl border-t border-border bg-panel/95 px-2 pt-2 shadow-[var(--shadow-overlay)] backdrop-blur-xl lg:hidden">
      <NavigationLinks items={bottomNavigationItems} pathname={pathname} mobile />
    </nav>
  </>;
}

function NavigationLinks({ items, pathname, mobile = false }: { items: readonly ProductNavigationItem[]; pathname: string; mobile?: boolean }) {
  return <ul className={mobile ? "mx-auto grid max-w-xl grid-cols-5 gap-1" : "space-y-2"}>
    {items.map(item => {
      const active = isNavigationItemActive(pathname, item.href);
      const Icon = icons[item.icon];
      return <li key={item.href}>
        <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(
          "flex min-h-14 items-center rounded-xl text-text-muted transition hover:bg-panel-strong hover:text-text",
          mobile ? "flex-col justify-center gap-1 px-1 py-1 text-[11px] font-medium sm:text-body-xs" : "gap-3 px-4 text-body-sm font-medium",
          active && "bg-panel-strong text-text",
        )}>
          <Icon aria-hidden="true" className="size-6 shrink-0" strokeWidth={active ? 2 : 1.7} />
          <span>{item.label}</span>
        </Link>
      </li>;
    })}
  </ul>;
}
