export interface NavigationItem {
  readonly href: string;
  readonly label: string;
}

/** Secondary destinations retained in the header menu. */
export const navigationItems = [
  { label: "Market", href: "/marketplace" },
  { label: "Forum", href: "/forums" },
  { label: "Escrow", href: "/escrow" },
] as const satisfies readonly NavigationItem[];

export const sidebarItems = [
  { label: "Home", href: "/", icon: "home" },
  { label: "Market", href: "/marketplace", icon: "market" },
  { label: "Orders", href: "/account/orders", icon: "orders" },
  { label: "Wallet", href: "/account/wallet", icon: "wallet" },
  { label: "Referrals", href: "/affiliate", icon: "referrals" },
] as const;

export const bottomNavigationItems = [
  ...sidebarItems.slice(0, 4),
  { label: "Forum", href: "/forums", icon: "forum" },
] as const;

export function isNavigationItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === href;
  if (href === "/forums" && (pathname === "/threads" || pathname.startsWith("/threads/"))) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
