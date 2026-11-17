import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { EmptyState } from "@/components/empty-state";
import { Greeting } from "@/components/greeting";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { PrimaryLink } from "@/components/ui";
import {
  ArrowRightIcon,
  BellIcon,
  BoltIcon,
  CalendarDotsIcon,
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  ShareIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons";
import { countEventMembersForOwner, listEventsForUser } from "@/lib/events";
import { dayNumber, monthShort, shortDate, startTime } from "@/lib/event-format";
import { getSessionUser } from "@/lib/session-cookie";

const quickLinks = [
  {
    href: "/my-events",
    label: "View my events",
    hint: "Everything you manage",
    Icon: CalendarIcon,
  },
  {
    href: "/users",
    label: "Manage users",
    hint: "Team & member directory",
    Icon: UsersIcon,
  },
  {
    href: "/calendar",
    label: "Check calendar",
    hint: "Plan the month ahead",
    Icon: CalendarDotsIcon,
  },
  {
    href: "/notifications",
    label: "Notifications",
    hint: "Reminders and shared events",
    Icon: BellIcon,
  },
];

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-[136px] animate-pulse rounded-2xl border border-line bg-panel"
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="h-[400px] animate-pulse rounded-2xl border border-line bg-panel" />
        <div className="space-y-5">
          <div className="h-[236px] animate-pulse rounded-2xl border border-line bg-panel" />
          <div className="h-[200px] animate-pulse rounded-2xl bg-nav/90" />
        </div>
      </div>
    </div>
  );
}

async function DashboardContent() {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [events, teamMembers] = await Promise.all([
    listEventsForUser(user.id),
    countEventMembersForOwner(user.id),
  ]);

  const now = new Date().getTime();
  const upcoming = events
    .filter((event) => new Date(event.startsAt).getTime() >= now)
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  const pastCount = events.length - upcoming.length;
  const shared = events.filter((event) => event.ownerId !== user.id);
  const nextEvent = upcoming[0];
  const daysUntilNext = nextEvent
    ? Math.ceil((new Date(nextEvent.startsAt).getTime() - now) / 86_400_000)
    : null;
  const preview = upcoming.slice(0, 4);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Upcoming events"
          value={String(upcoming.length)}
          caption={
            nextEvent
              ? `Next on ${shortDate.format(new Date(nextEvent.startsAt))}`
              : "Nothing scheduled yet"
          }
          tone="indigo"
          icon={<CalendarIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Total events"
          value={String(events.length)}
          caption={
            events.length === 0
              ? "Create your first event"
              : `${pastCount} past · ${upcoming.length} upcoming`
          }
          tone="emerald"
          icon={<TicketIcon className="h-4 w-4" />}
        />
        <StatCard
          label="Shared with you"
          value={String(shared.length)}
          caption={
            shared.length === 0
              ? "No shared events yet"
              : "Events you collaborate on"
          }
          tone="rose"
          icon={<ShareIcon className="h-3.5 w-3.5" />}
        />
        <StatCard
          label="Team members"
          value={String(teamMembers)}
          caption={
            teamMembers === 0
              ? "Just you so far"
              : "People across the events you own"
          }
          tone="amber"
          icon={<UsersIcon className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-panel shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4 sm:px-6">
            <div>
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
                Upcoming events
              </h2>
              <p className="mt-1 text-[12.5px] text-muted">
                Your next events, whether you own them or collaborate on them.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              {daysUntilNext !== null &&
              daysUntilNext >= 0 &&
              daysUntilNext <= 60 ? (
                <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] font-semibold text-accent ring-1 ring-inset ring-accent-line">
                  {daysUntilNext === 0
                    ? "Today"
                    : daysUntilNext === 1
                      ? "Tomorrow"
                      : `In ${daysUntilNext} days`}
                </span>
              ) : null}
              <Link
                href="/my-events"
                className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-semibold text-accent transition-colors hover:text-[#a9512a]"
              >
                View all
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {preview.length === 0 ? (
              <EmptyState
                icon={<CalendarIcon className="h-5 w-5" />}
                title="No upcoming events yet"
                description="Create an event and it will show up here with its date, venue and team."
                action={
                  <PrimaryLink href="/events/new">
                    Create an event
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </PrimaryLink>
                }
              />
            ) : (
              <ul className="space-y-1">
                {preview.map((event) => {
                  const startsAt = new Date(event.startsAt);
                  const isOwner = event.ownerId === user.id;

                  return (
                    <li
                      key={event.id}
                      className="flex flex-col gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-sunken/70 sm:flex-row sm:items-center"
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-accent-line bg-accent-soft">
                        <span className="font-mono text-[8.5px] font-bold uppercase tracking-[0.12em] text-accent">
                          {monthShort.format(startsAt)}
                        </span>
                        <span className="text-[17px] font-semibold leading-none text-ink">
                          {dayNumber.format(startsAt)}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/events/${event.id}`}
                            className="truncate text-[13.5px] font-semibold text-ink transition-colors hover:text-accent"
                          >
                            {event.title}
                          </Link>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ring-inset ${
                              isOwner
                                ? "bg-sunken text-ink-soft ring-line"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
                            }`}
                          >
                            {isOwner ? "Owner" : "Shared"}
                          </span>
                        </div>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                          <span className="inline-flex items-center gap-1">
                            <ClockIcon className="h-3.5 w-3.5 text-faint" />
                            {startTime.format(startsAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPinIcon className="h-3.5 w-3.5 text-faint" />
                            {event.venue || "Location to be announced"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <TicketIcon className="h-3.5 w-3.5 text-faint" />
                            {event.capacity
                              ? `${event.capacity} capacity`
                              : "Unlimited"}
                          </span>
                        </p>
                      </div>

                      <Link
                        href={`/events/${event.id}`}
                        className="self-start rounded-lg border border-line px-3 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:bg-panel sm:self-auto"
                      >
                        Open
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-panel p-5 shadow-panel">
            <h2 className="flex items-center gap-2 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted">
              <BoltIcon className="h-3.5 w-3.5 text-accent" />
              Quick access
            </h2>
            <ul className="mt-3 space-y-1">
              {quickLinks.map(({ href, label, hint, Icon }) => (
                <li key={label}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-sunken"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-sunken/70 text-ink-soft transition-colors group-hover:border-accent-line group-hover:bg-accent-soft group-hover:text-accent">
                      <Icon className="h-[17px] w-[17px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-ink">
                        {label}
                      </span>
                      <span className="block text-[11.5px] text-muted">
                        {hint}
                      </span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 text-line-strong transition-transform group-hover:translate-x-0.5 group-hover:text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="relative overflow-hidden rounded-2xl bg-nav p-6 text-white shadow-panel">
            <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-accent/25 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
            <p className="relative font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-white/50">
              Notifications
            </p>
            <h2 className="relative mt-2.5 max-w-[200px] text-[17px] font-semibold leading-snug tracking-tight">
              Never miss an important event
            </h2>
            <p className="relative mt-2 max-w-[220px] text-[12.5px] leading-relaxed text-white/60">
              Turn on reminders and see events shared with you in one feed.
            </p>
            <Link
              href="/settings"
              className="relative mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-white/90"
            >
              Manage notifications
            </Link>
            <BellIcon className="pointer-events-none absolute -bottom-6 -right-2 h-28 w-28 text-white/[0.06]" />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Overview"
        title={
          <Suspense fallback="Welcome back">
            <Greeting />
          </Suspense>
        }
        description="Welcome back. Here is how the events you run and follow are doing today."
        action={
          <PrimaryLink href="/events/new">
            <PlusIcon className="h-4 w-4" />
            Create event
          </PrimaryLink>
        }
      />

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
