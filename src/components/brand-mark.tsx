import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link
      href="/"
      aria-label="GuildHarbor home"
      className={cn("inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-focus", className)}
    >
      <Image src="/guildharbor-mark.svg" alt="" width={76} height={46} priority />
      {!compact && (
        <span className="hidden text-sm font-bold tracking-[0.16em] text-text-secondary xl:block">
          GUILDHARBOR
        </span>
      )}
    </Link>
  );
}
