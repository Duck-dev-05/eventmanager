import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { EventAgendaList } from "@/components/event-agenda-list";
import { EventTabSkeleton } from "@/components/event-tab-skeleton";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
} from "@/components/icons";
import { secondaryButton } from "@/components/ui";
import { getEventAgenda, summarizeAgenda } from "@/lib/agenda";
import { findEventForUser, getEventRole } from "@/lib/events";
import { longDate, startTime } from "@/lib/event-format";
import { rolePermissions } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";

export const instant = false;

function formatDurationHoursMins(minutes: number): string {
  if (minutes === 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining} mins`;
  if (remaining === 0) return `${hours} hr${hours > 1 ? "s" : ""}`;
  return `${hours} hr${hours > 1 ? "s" : ""} ${remaining}m`;
}

async function Schedule({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [event, role, agenda] = await Promise.all([
    findEventForUser(id, user.id),
    getEventRole(id, user.id),
    getEventAgenda(id),
  ]);

  if (!event || !role) notFound();

  const permissions = rolePermissions(role);
  const summary = summarizeAgenda(agenda);
  const startsAt = new Date(event.startsAt);
  const isHost = role === "owner";

  const completionPercent =
    summary.total > 0
      ? Math.round((summary.completed / summary.total) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-3">
      {/* Main Agenda Timeline */}
      <div className="xl:col-span-2">
        <EventAgendaList
          eventId={id}
          eventStartsAt={event.startsAt}
          defaultVenue={event.venue}
          items={agenda}
          canEdit={permissions.canEdit}
          canDelete={permissions.canDelete}
        />
      </div>

      {/* Sidebar Stats & Context */}
      <aside className="space-y-5 xl:sticky xl:top-[92px]">
        {/* Schedule Summary Card */}
        <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
          <header className="border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
            <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
              Schedule summary
            </h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Session duration and milestone progress.
            </p>
          </header>

          <div className="space-y-4 px-5 py-4">
            <div>
              <div className="flex items-baseline justify-between text-[12px]">
                <span className="font-medium text-zinc-600">Run progress</span>
                <span className="font-semibold text-zinc-900">
                  {summary.completed} of {summary.total} completed
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#f0ede5]">
                <div
                  className="h-full rounded-full bg-[#193b30] transition-all duration-300"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            <dl className="divide-y divide-[#f2efe8] pt-1">
              <div className="flex items-center justify-between py-2 text-[12.5px]">
                <dt className="text-zinc-500">Programmed runtime</dt>
                <dd className="font-semibold text-zinc-800">
                  {formatDurationHoursMins(summary.totalDurationMinutes)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2 text-[12.5px]">
                <dt className="text-zinc-500">Scheduled sessions</dt>
                <dd className="font-semibold text-zinc-800">{summary.scheduled}</dd>
              </div>
              {summary.live > 0 ? (
                <div className="flex items-center justify-between py-2 text-[12.5px]">
                  <dt className="flex items-center gap-1.5 font-medium text-emerald-700">
                    <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
                    Currently Live
                  </dt>
                  <dd className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-200">
                    {summary.live}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>

        {/* Event Window */}
        <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
          <header className="border-b border-[#f0ede5] bg-[#fcfbf8]/70 px-5 py-4">
            <h2 className="text-[14.5px] font-semibold tracking-tight text-[#18231d]">
              Event window
            </h2>
          </header>

          <dl className="space-y-3 px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
                Date
              </dt>
              <dd className="text-right text-[13px] font-medium text-zinc-800">
                {longDate.format(startsAt)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                <ClockIcon className="h-3.5 w-3.5 text-zinc-400" />
                Doors open
              </dt>
              <dd className="text-[13px] font-medium text-zinc-800">
                {startTime.format(startsAt)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-[12.5px] text-zinc-500">
                <MapPinIcon className="h-3.5 w-3.5 text-zinc-400" />
                Venue
              </dt>
              <dd className="max-w-[180px] truncate text-right text-[13px] font-medium text-zinc-800">
                {event.venue || "Location to be announced"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Operations & Shortcuts */}
        <section className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.025]">
          <div className="space-y-3 p-5">
            <h3 className="text-[13.5px] font-semibold text-[#18231d]">
              Print & Operations
            </h3>
            <p className="text-[12px] leading-relaxed text-zinc-500">
              Need a physical sheet for stage managers and day-of staff?
            </p>
            <div className="flex flex-col gap-2 pt-1">
              <Link
                href={`/events/${id}/print`}
                className={`${secondaryButton} justify-center text-[12px]`}
              >
                Print official run sheet
              </Link>
              {isHost ? (
                <Link
                  href={`/events/${id}/settings`}
                  className="inline-flex items-center justify-center rounded-xl px-3 py-2 text-[12px] font-semibold text-zinc-600 transition hover:bg-[#faf8f2] hover:text-[#193b30]"
                >
                  Adjust event date & venue →
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

export default function EventSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EventTabSkeleton />}>
      {params.then(({ id }) => (
        <Schedule id={id} />
      ))}
    </Suspense>
  );
}
