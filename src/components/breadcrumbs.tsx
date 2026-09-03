import { ChevronRight } from "lucide-react";
import Link from "next/link";

export function Breadcrumbs({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-xs font-bold uppercase tracking-[0.06em] text-text-muted">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1">
          {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
          {item.href ? <Link href={item.href} className="hover:text-text">{item.label}</Link> : <span className="text-text-secondary">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
