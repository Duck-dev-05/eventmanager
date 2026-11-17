"use client";

import { useState } from "react";
import { resolveAvatarUrl } from "@/lib/avatar";
import { UserIcon } from "./icons";

const sizes = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-11 w-11 text-sm",
  xl: "h-16 w-16 text-lg",
} as const;

export function Avatar({
  initials,
  src,
  size = "md",
  className = "",
}: {
  initials?: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  // Track which URL failed so a new Google photo is attempted after a re-login
  // instead of staying stuck on the initials fallback.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imageSrc = resolveAvatarUrl(src);
  const shared = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold uppercase tracking-wide ring-2 ring-white/70 ${sizes[size]} ${className}`;

  if (imageSrc && failedSrc !== imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={initials ? `${initials} avatar` : "User avatar"}
        referrerPolicy="no-referrer"
        onError={() => setFailedSrc(imageSrc)}
        className={`${shared} object-cover`}
      />
    );
  }

  return (
    <span
      className={`${shared} bg-gradient-to-br from-[#193b30] via-[#245241] to-[#367961] text-white`}
    >
      {initials ?? <UserIcon className="h-[55%] w-[55%]" />}
    </span>
  );
}
