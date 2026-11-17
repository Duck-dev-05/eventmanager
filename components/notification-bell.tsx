"use client";

import Link from "next/link";
import { BellIcon } from "@/components/icons";
import { useUnreadNotifications } from "@/lib/notification-hooks";

const variants = {
  light: {
    link: "text-zinc-500 hover:bg-[#edeae2] hover:text-zinc-800",
    dot: "right-1.5 top-1.5 ring-[#fbfaf7]",
  },
  nav: {
    link: "text-slate-400 hover:bg-white/10 hover:text-white",
    dot: "right-2 top-2 ring-nav",
  },
} as const;

/**
 * Bell with a live unread indicator. The dot only renders when the stored
 * count is above zero, so an empty feed no longer looks like an alert.
 */
export function NotificationBell({
  variant = "light",
}: {
  variant?: keyof typeof variants;
}) {
  const { unread } = useUnreadNotifications();
  const count = unread.count ?? 0;
  const styles = variants[variant];

  return (
    <Link
      href="/notifications"
      aria-label={
        count > 0 ? `Notifications, ${count} unread` : "Notifications"
      }
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${styles.link}`}
    >
      <BellIcon className="h-[19px] w-[19px]" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          className={`absolute h-2 w-2 rounded-full bg-rose-500 ring-2 ${styles.dot}`}
        />
      ) : null}
    </Link>
  );
}
