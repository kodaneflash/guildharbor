import { Bell, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

const settingsLinks = [
  { href: "/settings/profile", label: "Profile", icon: UserRound, key: "profile" },
  { href: "/settings/security", label: "Security", icon: LockKeyhole, key: "security" },
  { href: "/settings/notifications", label: "Notifications", icon: Bell, key: "notifications" },
] as const;

export function SettingsNav({ active }: { active: (typeof settingsLinks)[number]["key"] }) {
  return (
    <nav aria-label="Settings" className="surface h-fit p-2">
      {settingsLinks.map(({ href, label, icon: Icon, key }) => (
        <Link
          key={key}
          href={href}
          aria-current={active === key ? "page" : undefined}
          className={cn(
            "flex min-h-12 items-center gap-3 rounded-xl px-3 text-body-sm font-medium text-text-secondary transition-colors hover:bg-panel-strong hover:text-text",
            active === key && "bg-panel-strong text-text",
          )}
        >
          <span className="grid size-8 place-items-center rounded-lg bg-panel-raised text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
