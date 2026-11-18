import Link from "next/link";
import { connection } from "next/server";
import { ChevronRightIcon, ClockIcon } from "./icons";
import { eventStatus, listEventsForUser } from "@/lib/events";
import { getSessionUser } from "@/lib/session-cookie";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * The next event on the viewer's calendar, rendered as a sidebar card so the
 * space between the nav list and the account card stays useful.
 */
export async function SidebarNextEvent() {
  await connection();
  const user = await getSessionUser();
  if (!user) return null;

  const events = await listEventsForUser(user.id);
  const next = events
    .filter((event) => eventStatus(event.startsAt) === "Upcoming")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  if (!next) {
    return (
      <Link
        href="/events/new"
        className="block rounded-2xl border border-dashed border-line-strong bg-white/60 p-3.5 transition-colors hover:bg-sunken/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">
          <ClockIcon className="h-3.5 w-3.5" />
          Next up
        </p>
        <p className="mt-1.5 text-[13px] font-semibold text-ink">
          Nothing scheduled
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted">
          Plan your first event and it will appear here.
        </p>
      </Link>
    );
  }

  return (
    <Link
      href={`/events/${next.id}`}
      title={next.title}
      className="block rounded-2xl border border-line bg-white p-3.5 shadow-panel transition-shadow hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-faint">
        <ClockIcon className="h-3.5 w-3.5" />
        Next up
      </p>
      <p className="mt-1.5 truncate text-[13px] font-semibold text-ink">
        {next.title}
      </p>
      <p className="mt-0.5 truncate text-[11.5px] text-muted">
        {dateFormatter.format(new Date(next.startsAt))}
        {next.venue ? ` · ${next.venue}` : ""}
      </p>
      <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-accent">
        Open event
        <ChevronRightIcon className="h-3 w-3" />
      </span>
    </Link>
  );
}
