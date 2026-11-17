import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { PageHeader } from "@/components/page-header";
import { PrimaryLink } from "@/components/ui";
import {
  CalendarIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  UsersIcon,
} from "@/components/icons";
import { listEventsForUser } from "@/lib/events";
import { startTime } from "@/lib/event-format";
import { getSessionUser } from "@/lib/session-cookie";

// The month filter comes from search params, so this route renders on demand.
export const instant = false;

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const monthLabel = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

function parseMonth(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})$/);
  const now = new Date();

  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;

    if (year >= 2000 && year <= 2100 && month >= 0 && month <= 11) {
      return new Date(year, month, 1);
    }
  }

  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function CalendarSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <div className="h-[560px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white xl:col-span-2" />
      <div className="h-[280px] animate-pulse rounded-3xl border border-zinc-200/70 bg-white" />
    </div>
  );
}

async function MonthCalendar({ monthParam }: { monthParam?: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const events = await listEventsForUser(user.id);
  const first = parseMonth(monthParam);
  const year = first.getFullYear();
  const month = first.getMonth();

  const monthEvents = events
    .filter((event) => {
      const startsAt = new Date(event.startsAt);
      return startsAt.getFullYear() === year && startsAt.getMonth() === month;
    })
    .map((event) => ({
      event,
      startsAt: new Date(event.startsAt),
      isOwner: event.ownerId === user.id,
    }));

  const byDay = new Map<number, typeof monthEvents>();
  for (const item of monthEvents) {
    const day = item.startsAt.getDate();
    byDay.set(day, [...(byDay.get(day) ?? []), item]);
  }

  const leading = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;
  const today = new Date();

  const cells = Array.from({ length: totalCells }, (_, index) => {
    const day = index - leading + 1;
    const inMonth = day >= 1 && day <= daysInMonth;
    const cellDate = new Date(year, month, day);

    return {
      key: index,
      inMonth,
      day: cellDate.getDate(),
      isToday:
        inMonth &&
        cellDate.getFullYear() === today.getFullYear() &&
        cellDate.getMonth() === today.getMonth() &&
        cellDate.getDate() === today.getDate(),
      events: inMonth ? (byDay.get(day) ?? []) : [],
    };
  });

  const previous = monthKey(new Date(year, month - 1, 1));
  const next = monthKey(new Date(year, month + 1, 1));
  const current = monthKey(today);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
      <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02] xl:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight text-zinc-900">
              {monthLabel.format(first)}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-zinc-500">
              {monthEvents.length === 0
                ? "Nothing scheduled this month"
                : `${monthEvents.length} ${
                    monthEvents.length === 1 ? "event" : "events"
                  } scheduled`}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={`/calendar?month=${current}`}
              className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
            >
              Today
            </Link>
            <Link
              href={`/calendar?month=${previous}`}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
            >
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
            </Link>
            <Link
              href={`/calendar?month=${next}`}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-800"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 border-y border-zinc-100 bg-zinc-50/60">
          {weekdays.map((weekday) => (
            <div
              key={weekday}
              className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400"
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px bg-zinc-100">
          {cells.map((cell) => (
            <div
              key={cell.key}
              className={`min-h-[98px] p-2 ${
                cell.inMonth ? "bg-white" : "bg-zinc-50/70"
              }`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium ${
                  cell.isToday
                    ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-600/30"
                    : cell.inMonth
                      ? "text-zinc-700"
                      : "text-zinc-300"
                }`}
              >
                {cell.day}
              </span>

              <div className="mt-1 space-y-1">
                {cell.events.map(({ event, startsAt, isOwner }) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    title={`${event.title} · ${startTime.format(startsAt)}`}
                    className={`block truncate rounded-md px-1.5 py-1 text-[10px] font-medium ring-1 ring-inset transition-opacity hover:opacity-80 ${
                      isOwner
                        ? "bg-indigo-50 text-indigo-700 ring-indigo-100/70"
                        : "bg-emerald-50 text-emerald-700 ring-emerald-100/70"
                    }`}
                  >
                    {startTime.format(startsAt)} {event.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <aside>
        <section className="rounded-3xl border border-zinc-200/70 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
              Agenda
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
              {monthLabel.format(first)}
            </span>
          </div>

          {monthEvents.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-zinc-200 bg-gradient-to-b from-zinc-50/80 to-white px-4 py-10 text-center">
              <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-indigo-500 shadow-sm ring-1 ring-zinc-200/80">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[13px] font-medium text-zinc-700">
                Nothing scheduled this month
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
                Add an event or browse another month.
              </p>
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {monthEvents.map(({ event, startsAt, isOwner }) => (
                <li key={event.id}>
                  <Link
                    href={`/events/${event.id}`}
                    className="flex items-start gap-3 rounded-xl border border-zinc-100 p-3 transition-colors hover:border-indigo-100 hover:bg-indigo-50/40"
                  >
                    <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-violet-50 text-[11px] font-bold text-indigo-600 ring-1 ring-inset ring-indigo-100">
                      {startsAt.getDate()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-zinc-900">
                          {event.title}
                        </span>
                        {isOwner ? null : (
                          <UsersIcon className="h-3 w-3 shrink-0 text-emerald-500" />
                        )}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500">
                        <span className="inline-flex items-center gap-1">
                          <ClockIcon className="h-3 w-3 text-zinc-400" />
                          {startTime.format(startsAt)}
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPinIcon className="h-3 w-3 shrink-0 text-zinc-400" />
                          <span className="truncate">
                            {event.venue || "To be announced"}
                          </span>
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace"
        title="Calendar"
        description="See every event you run or follow at a glance."
        action={
          <PrimaryLink href="/events/new">
            <PlusIcon className="h-4 w-4" />
            Add event
          </PrimaryLink>
        }
      />

      <Suspense fallback={<CalendarSkeleton />}>
        <MonthCalendar monthParam={month} />
      </Suspense>
    </div>
  );
}
