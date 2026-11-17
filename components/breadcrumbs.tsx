"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRightIcon, GridIcon } from "./icons";

const labels: Record<string, string> = {
  dashboard: "Dashboard",
  "my-events": "My Events",
  calendar: "Calendar",
  templates: "Templates",
  "my-activity": "My Activity",
  profile: "Profile",
  settings: "Settings",
  notifications: "Notifications",
  help: "Help & support",
  events: "Events",
  new: "New event",
  tasks: "Tasks",
  members: "Members",
  schedule: "Schedule",
  files: "Files",
  activity: "Activity",
  users: "Users",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const items = segments
    .map((segment, index) => {
      const href = `/${segments.slice(0, index + 1).join("/")}`;
      let label = labels[segment];

      if (!label) {
        label =
          segments[index - 1] === "events"
            ? "Event"
            : decodeURIComponent(segment);
      }

      return { href, label };
    })
    .filter((item, index) => !(index === 0 && item.label === "Dashboard"));

  const trail =
    items.length > 0 ? items : [{ href: "/dashboard", label: "Dashboard" }];

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1 text-[12.5px]"
    >
      <Link
        href="/dashboard"
        aria-label="Dashboard"
        className="flex items-center rounded-lg px-1.5 py-1 text-faint transition-colors hover:bg-sunken hover:text-ink-soft"
      >
        <GridIcon className="h-3.5 w-3.5" />
      </Link>

      {trail.map((item, index) => {
        const last = index === trail.length - 1;

        return (
          <span key={item.href} className="flex min-w-0 items-center gap-1">
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-line-strong" />
            {last ? (
              <span
                aria-current="page"
                className="truncate font-semibold text-ink"
              >
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="truncate font-medium text-muted transition-colors hover:text-ink"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
