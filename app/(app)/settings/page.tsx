import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { CalendarFeedCard } from "@/components/calendar-feed-card";
import { DesktopSyncCard } from "@/components/desktop-sync-card";
import { PageHeader } from "@/components/page-header";
import { PreferencesForm } from "@/components/preferences-form";
import { secondaryButton } from "@/components/ui";
import {
  BellIcon,
  ChevronRightIcon,
  HelpCircleIcon,
  UserIcon,
} from "@/components/icons";
import { getOrCreateCalendarToken } from "@/lib/calendar-feed";
import { getPreferences } from "@/lib/preferences";
import { getSessionUser } from "@/lib/session-cookie";
import { listSyncDevices } from "@/lib/sync";

const quickLinks = [
  {
    href: "/profile",
    label: "Your profile",
    description: "Name, email and account details",
    Icon: UserIcon,
  },
  {
    href: "/notifications",
    label: "Notifications",
    description: "What is coming up next",
    Icon: BellIcon,
  },
  {
    href: "/help",
    label: "Help & support",
    description: "Answers to common questions",
    Icon: HelpCircleIcon,
  },
];

function SettingsSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="h-[520px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]" />
      <div className="h-[280px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]" />
    </div>
  );
}

async function SettingsContent() {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [preferences, calendarToken, devices, headerList] = await Promise.all([
    getPreferences(user.id),
    getOrCreateCalendarToken(user.id),
    listSyncDevices(user.id),
    headers(),
  ]);

  const host = headerList.get("host");
  const protocol =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const calendarPath = `/api/calendar/${calendarToken}`;
  const feedUrl = host ? `${protocol}://${host}${calendarPath}` : calendarPath;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-6">
        <PreferencesForm preferences={preferences} />
        <div className="mt-6 border-t border-zinc-100 pt-6">
          <CalendarFeedCard feedUrl={feedUrl} />
        </div>
        <div className="mt-6 border-t border-zinc-100 pt-6">
          <DesktopSyncCard devices={devices} />
        </div>
      </section>

      <section className="rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          More in your account
        </h2>
        <p className="mt-0.5 text-[13px] text-zinc-500">
          Jump straight to the page you need.
        </p>

        <ul className="mt-4 divide-y divide-zinc-100">
          {quickLinks.map(({ href, label, description, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex items-center gap-3 py-3.5 transition-colors hover:text-indigo-600"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
                  <Icon className="h-[17px] w-[17px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-zinc-900 transition-colors group-hover:text-indigo-600">
                    {label}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                    {description}
                  </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-indigo-500" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-200/80">
          <p className="text-[12.5px] font-semibold text-zinc-900">
            Signed in as
          </p>
          <p className="mt-1 truncate text-[12.5px] text-zinc-500">
            {user.email}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="Choose how EventPulse keeps you informed and pre-fills your events."
        action={
          <Link href="/profile" className={secondaryButton}>
            <UserIcon className="h-4 w-4" />
            View profile
          </Link>
        }
      />

      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </div>
  );
}
