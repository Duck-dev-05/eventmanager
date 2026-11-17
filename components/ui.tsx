import type { ReactNode } from "react";
import Link from "next/link";

/** Shared surface for cards, panels and table shells. */
export const panelClass =
  "rounded-2xl border border-line bg-panel shadow-panel";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-accent/25 transition-colors hover:bg-[#b95c26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70";

export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-panel px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft shadow-panel transition-colors hover:border-line-strong hover:bg-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2";

export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={primaryButton}>
      {children}
    </Link>
  );
}
