"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "./empty-state";
import { PrimaryLink } from "./ui";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  PlusIcon,
  TicketIcon,
} from "./icons";

export type EventListItem = {
  id: string;
  title: string;
  month: string;
  day: string;
  time: string;
  venue: string;
  capacity: number | null;
  status: "Upcoming" | "Past";
  isOwner: boolean;
};

const filters = [
  { id: "all", label: "All events" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "shared", label: "Shared" },
] as const;

type Filter = (typeof filters)[number]["id"];

const emptyCopy: Record<
  Filter,
  { title: string; description: string; canCreate: boolean }
> = {
  all: {
    title: "No events yet",
    description:
      "Events you create will show up here with their date, venue and capacity.",
    canCreate: true,
  },
  upcoming: {
    title: "Nothing upcoming",
    description:
      "You have no future events scheduled. Create one to get the ball rolling.",
    canCreate: true,
  },
  past: {
    title: "No past events",
    description:
      "Events move here automatically once their start time has passed.",
    canCreate: true,
  },
  shared: {
    title: "No shared events",
    description:
      "When an owner invites you to an event, it will appear here with collaborator access.",
    canCreate: false,
  },
};

export function EventsList({ events }: { events: EventListItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    switch (filter) {
      case "upcoming":
        return events.filter((event) => event.status === "Upcoming");
      case "past":
        return events.filter((event) => event.status === "Past");
      case "shared":
        return events.filter((event) => !event.isOwner);
      default:
        return events;
    }
  }, [events, filter]);

  const empty = emptyCopy[filter];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200/70 bg-white/80 p-1 shadow-sm shadow-zinc-900/[0.02] backdrop-blur sm:w-auto">
          {filters.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`flex-1 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[12.5px] font-medium transition-all sm:flex-none ${
                filter === id
                  ? "bg-zinc-900 text-white shadow-sm"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] font-medium text-zinc-400">
          {visible.length} {visible.length === 1 ? "event" : "events"}
        </p>
      </div>

      <section className="overflow-hidden rounded-3xl border border-zinc-200/70 bg-white shadow-sm shadow-zinc-900/[0.02]">
        {visible.length === 0 ? (
          <div className="p-2.5">
            <EmptyState
              icon={<CalendarIcon className="h-5 w-5" />}
              title={empty.title}
              description={empty.description}
              action={
                empty.canCreate ? (
                  <PrimaryLink href="/events/new">
                    <PlusIcon className="h-4 w-4" />
                    Create event
                  </PrimaryLink>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((event) => (
              <li
                key={event.id}
                className="group flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:px-5"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 to-white shadow-sm shadow-zinc-900/[0.03]">
                  <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-indigo-500">
                    {event.month}
                  </span>
                  <span className="text-[19px] font-semibold leading-none text-zinc-900">
                    {event.day}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="truncate text-[14.5px] font-semibold text-zinc-900 transition-colors hover:text-indigo-600"
                    >
                      {event.title}
                    </Link>
                    {!event.isOwner ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-100">
                        Shared
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-zinc-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
                      {event.time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
                      {event.venue}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <TicketIcon className="h-3.5 w-3.5 text-zinc-400" />
                      {event.capacity ? `${event.capacity} capacity` : "Unlimited"}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1 ring-inset ${
                      event.status === "Upcoming"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200/70"
                        : "bg-zinc-100 text-zinc-500 ring-zinc-200"
                    }`}
                  >
                    {event.status}
                  </span>
                  <Link
                    href={`/events/${event.id}`}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-medium text-zinc-700 shadow-sm shadow-zinc-900/[0.02] transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
