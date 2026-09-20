"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

const avatarTones = [
  "from-cyan/35 to-category/10 text-cyan",
  "from-pink/35 to-danger/10 text-pink",
  "from-trust/35 to-sticky/10 text-trust",
  "from-orange/35 to-yellow/10 text-yellow",
  "from-focus/35 to-selling/10 text-category",
] as const;

function toneFor(seed: string) {
  return avatarTones[
    [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) %
      avatarTones.length
  ];
}

export function UserAvatar({
  seed,
  src,
  eager = false,
  size = "md",
  className,
}: {
  seed: string;
  src?: string;
  eager?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const sizeClass = {
    sm: "size-8 text-label-sm",
    md: "size-11 text-body-xs",
    lg: "size-16 text-body-md",
    xl: "size-32 text-display-sm sm:size-40",
  }[size];

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br font-extrabold tracking-wide",
        toneFor(seed),
        sizeClass,
        className,
      )}
    >
      {src?.startsWith("/api/files/") && src !== failedSrc ? (
        <Image
          unoptimized
          src={src}
          alt=""
          fill
          loading={eager ? "eager" : "lazy"}
          sizes={
            size === "xl"
              ? "160px"
              : size === "lg"
                ? "128px"
                : size === "md"
                  ? "44px"
                  : "32px"
          }
          className="object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        seed.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
