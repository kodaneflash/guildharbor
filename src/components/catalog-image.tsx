"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function CatalogImage({ id, title, compact = false, cover = false }: { id: string | null; title: string; compact?: boolean; cover?: boolean }) {
  const [failedId, setFailedId] = useState<string>();
  return (
    <div className={cn("flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel", cover ? "aspect-[4/3] w-full rounded-none" : compact ? "w-14" : "w-24 sm:w-32")}>
      {id && id !== failedId ? (
        <Image src={`/api/files/${id}?preview=1`} alt={title} width={128} height={128} unoptimized className={cn("size-full", cover ? "object-cover" : "object-contain")} onError={() => setFailedId(id)} />
      ) : (
        <span className="flex flex-col items-center gap-2 p-2 text-center text-body-xs text-text-muted">
          <ImageIcon aria-hidden="true" className={compact ? "size-5" : "size-6"} />
          <span className={compact ? "sr-only" : undefined}>{id ? "Image unavailable" : "No image yet"}</span>
        </span>
      )}
    </div>
  );
}
