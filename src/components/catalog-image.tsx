"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";

export function CatalogImage({ id, title }: { id: string | null; title: string }) {
  const [failedId, setFailedId] = useState<string>();
  return (
    <div className="flex aspect-square w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-panel sm:w-32">
      {id && id !== failedId ? (
        <Image src={`/api/files/${id}?preview=1`} alt={title} width={128} height={128} unoptimized className="size-full object-contain" onError={() => setFailedId(id)} />
      ) : (
        <span className="flex flex-col items-center gap-2 p-2 text-center text-body-xs text-text-muted">
          <ImageIcon aria-hidden="true" className="size-6" />
          {id ? "Image unavailable" : "No image yet"}
        </span>
      )}
    </div>
  );
}
