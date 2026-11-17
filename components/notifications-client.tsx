"use client";

import { BellIcon, ChevronRightIcon } from "@/components/icons";
import { useUnreadNotifications } from "@/lib/notification-hooks";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  meta: string;
  href: string;
}

interface NotificationGroup {
  title: string;
  hint: string;
  items: NotificationItem[];
}

export function NotificationsClient({ groups }: { groups: NotificationGroup[] }) {
  const { unread, markAllRead } = useUnreadNotifications();

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.title} className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">{group.title}</h2>
              <p className="mt-0.5 text-[12.5px] text-zinc-500">{group.hint}</p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-600">{group.items.length}</span>
          </div>
          <ul className="divide-y divide-zinc-100">
            {group.items.map((item) => (
              <li key={item.id}>
                <a
                  href={item.href}
                  className="group flex items-center gap-4 px-6 py-4 transition-colors hover:bg-zinc-50/70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-zinc-900 transition-colors group-hover:text-indigo-600">{item.title}</p>
                    <p className="mt-0.5 truncate text-[12.5px] text-zinc-500">{item.description}</p>
                    <p className="mt-1 text-[11.5px] font-medium text-zinc-400">{item.meta}</p>
                  </div>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-indigo-500" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <button
          type="button"
          onClick={markAllRead}
          className="flex w-full items-center justify-between gap-2 rounded-xl px-4 py-2 text-[12.5px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
        >
          <span className="flex items-center gap-2">
            <BellIcon className="h-4 w-4" />
            <span className="text-zinc-500">Mark all as read</span>
          </span>
          {unread.count != null && unread.count > 0 ? (
            <span className="text-zinc-400">{unread.count}</span>
          ) : (
            <span className="text-zinc-400">All caught up</span>
          )}
        </button>
      </div>
    </div>
  );
}
