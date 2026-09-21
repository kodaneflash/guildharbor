import {
  BookOpen,
  Handshake,
  HelpCircle,
  LockKeyhole,
  MessageSquareText,
  PackageSearch,
  ShieldCheck,
  UserRoundSearch,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

export interface NavigationItem {
  readonly description: string;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly label: string;
}

export interface NavigationGroup {
  readonly id: string;
  readonly items: readonly NavigationItem[];
  readonly label: string;
}

/** The single navigation source used by desktop and mobile menus. */
export const navigationGroups = [
  {
    id: "discover",
    label: "Discover",
    items: [
      {
        label: "Marketplace",
        description: "Browse member-made digital goods and services",
        href: "/marketplace",
        icon: PackageSearch,
      },
      {
        label: "Sellers",
        description: "Find established GuildHarbor storefronts",
        href: "/sellers",
        icon: UserRoundSearch,
      },
      {
        label: "Trusted sellers",
        description: "Explore sellers recognized by the community",
        href: "/sellers/trusted",
        icon: ShieldCheck,
      },
    ],
  },
  {
    id: "community",
    label: "Community",
    items: [
      {
        label: "Forums",
        description: "Trade knowledge with the GuildHarbor community",
        href: "/forums",
        icon: MessageSquareText,
      },
      {
        label: "Members",
        description: "Meet the people behind the marketplace",
        href: "/members",
        icon: UsersRound,
      },
      {
        label: "Community rules",
        description: "Read the standards that keep the harbor useful",
        href: "/rules",
        icon: BookOpen,
      },
    ],
  },
  {
    id: "trade",
    label: "Trade",
    items: [
      {
        label: "Auto-Escrow",
        description: "Review and manage protected member deals",
        href: "/escrow",
        icon: Handshake,
      },
      {
        label: "How escrow works",
        description: "Understand each stage before opening a deal",
        href: "/escrow/how-it-works",
        icon: LockKeyhole,
      },
      {
        label: "Help center",
        description: "Get answers about buying, selling, and accounts",
        href: "/help",
        icon: HelpCircle,
      },
    ],
  },
] as const satisfies readonly NavigationGroup[];

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
