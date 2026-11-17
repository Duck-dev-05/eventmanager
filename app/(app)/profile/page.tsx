import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Avatar } from "@/components/avatar";
import { AvatarManager } from "@/components/avatar-manager";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile-form";
import { StatCard } from "@/components/stat-card";
import { secondaryButton } from "@/components/ui";
import {
  CalendarIcon,
  ChevronRightIcon,
  MailIcon,
  SettingsIcon,
  ShieldIcon,
  UsersIcon,
} from "@/components/icons";
import { listEventsForUser } from "@/lib/events";
import { initialsOf } from "@/lib/initials";
import { getSessionUser } from "@/lib/session-cookie";
import { findUserById } from "@/lib/users";

const joinedFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-44 animate-pulse rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-[132px] animate-pulse rounded-2xl border border-zinc-200/80 bg-white"
          />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="h-[360px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]" />
        <div className="h-[360px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]" />
      </div>
    </div>
  );
}

async function ProfileContent() {
  await connection();

  const session = await getSessionUser();
  if (!session) redirect("/login");

  const [stored, events] = await Promise.all([
    findUserById(session.id),
    listEventsForUser(session.id),
  ]);

  const user = {
    name: stored?.name ?? session.name,
    email: stored?.email ?? session.email,
    avatarUrl: stored?.avatarUrl ?? session.avatarUrl,
    provider: stored?.provider ?? "password",
    hasGooglePhoto: Boolean(stored?.googleAvatarUrl),
    createdAt: stored?.createdAt ?? null,
  };

  const owned = events.filter((event) => event.ownerId === session.id);
  const shared = events.filter((event) => event.ownerId !== session.id);
  const upcoming = events.filter(
    (event) => new Date(event.startsAt).getTime() >= new Date().getTime(),
  );

  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
        <div className="h-24 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
        <div className="px-6 pb-6">
          <div className="-mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar
                initials={initialsOf(user.name)}
                src={user.avatarUrl}
                size="xl"
              />
              <div className="min-w-0 pb-1">
                <h2 className="truncate text-[20px] font-semibold tracking-tight text-zinc-900">
                  {user.name}
                </h2>
                <p className="mt-0.5 truncate text-[13px] text-zinc-500">
                  {user.email}
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-[11.5px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200">
              <ShieldIcon className="h-3.5 w-3.5 text-zinc-400" />
              {user.provider === "google" ? "Google account" : "Password account"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Events owned"
          value={String(owned.length)}
          caption="Events you created"
          tone="indigo"
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Shared with you"
          value={String(shared.length)}
          caption="Events you collaborate on"
          tone="emerald"
          icon={<UsersIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Upcoming"
          value={String(upcoming.length)}
          caption="Still ahead of you"
          tone="amber"
          icon={<ShieldIcon className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <MailIcon className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
                Profile details
              </h2>
              <p className="mt-0.5 text-[13px] text-zinc-500">
                How you appear across your workspace.
              </p>
            </div>
          </div>
          <div className="mt-5">
            <ProfileForm name={user.name} email={user.email} />
          </div>
          <div className="mt-5">
            <AvatarManager
              initials={initialsOf(user.name)}
              avatarUrl={user.avatarUrl}
              hasGooglePhoto={user.hasGooglePhoto}
            />
          </div>
        </section>

        <section className="flex flex-col rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] p-6">
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Account
          </h2>
          <dl className="mt-4 space-y-3 text-[13px]">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Member since</dt>
              <dd className="font-medium text-zinc-900">
                {user.createdAt
                  ? joinedFormatter.format(new Date(user.createdAt))
                  : "Recently"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Sign-in method</dt>
              <dd className="font-medium text-zinc-900">
                {user.provider === "google" ? "Google" : "Email & password"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Collaborations</dt>
              <dd className="font-medium text-zinc-900">{shared.length}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-zinc-500">Total events</dt>
              <dd className="font-medium text-zinc-900">{events.length}</dd>
            </div>
          </dl>

          <div className="mt-auto pt-6">
            <div className="rounded-2xl bg-indigo-50/70 p-4 ring-1 ring-inset ring-indigo-100">
              <p className="text-[12.5px] font-semibold text-indigo-900">
                Keep things in sync
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-indigo-700/80">
                Manage reminders and event defaults from settings.
              </p>
              <Link
                href="/settings"
                className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Open settings
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

export default function ProfilePage() {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Account"
        title="Your profile"
        description="Your name, sign-in details and the events you are part of."
        action={
          <Link href="/settings" className={secondaryButton}>
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
        }
      />

      <Suspense fallback={<ProfileSkeleton />}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
