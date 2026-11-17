"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { rolePermissions, type EventRole } from "@/lib/roles";
import {
  CalendarDotsIcon,
  CheckCircleSolidIcon,
  FileTextIcon,
  GridIcon,
  PulseIcon,
  SettingsIcon,
  UsersIcon,
} from "./icons";

const tabs = [
  { slug: "", label: "Overview", Icon: GridIcon },
  { slug: "tasks", label: "Tasks", Icon: CheckCircleSolidIcon },
  { slug: "members", label: "Members", Icon: UsersIcon },
  { slug: "schedule", label: "Schedule", Icon: CalendarDotsIcon },
  { slug: "files", label: "Files", Icon: FileTextIcon },
  { slug: "activity", label: "Activity", Icon: PulseIcon },
];

export function EventTabsSkeleton() {
  return (
    <nav className="overflow-x-auto border-b border-[#e5e2d9] py-3 print:hidden">
      <div className="flex h-5 w-80 animate-pulse rounded-lg bg-[#f0ede5]" />
    </nav>
  );
}

export function EventTabs({
  id,
  role = null,
}: {
  id: string;
  /** Null means the viewer has no role on this event (a public visitor). */
  role?: EventRole | null;
}) {
  const pathname = usePathname();
  const base = `/events/${id}`;
  const isHost = role === "owner";

  // Public visitors get the overview and its activity log only; team, files,
  // tasks and schedule all require a real role on the event.
  let visibleTabs = role
    ? rolePermissions(role).canViewFiles
      ? tabs
      : tabs.filter((tab) => tab.slug !== "files")
    : tabs.filter((tab) => tab.slug === "" || tab.slug === "activity");

  if (isHost) {
    visibleTabs = [
      ...visibleTabs,
      { slug: "settings", label: "Settings", Icon: SettingsIcon },
    ];
  }

  return (
    <div className="relative border-b border-[#e5e2d9] print:hidden">
      <nav className="overflow-x-auto pr-8 sm:pr-0" aria-label="Event tabs">
        <ul className="flex min-w-max items-center gap-5 sm:gap-8">
          {visibleTabs.map(({ slug, label, Icon }) => {
            const href = slug ? `${base}/${slug}` : base;
            const active = pathname === href;

            return (
              <li key={label}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex items-center gap-2 whitespace-nowrap border-b-2 px-1 py-3 text-[12.5px] font-semibold transition-colors ${
                    active
                      ? "border-[#d9773e] text-[#193b30]"
                      : "border-transparent text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* Subtle fade on right edge for mobile overflow cue */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 top-0 w-8 bg-gradient-to-l from-canvas to-transparent sm:hidden"
      />
    </div>
  );
}
