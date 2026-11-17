import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { PrintButton } from "@/components/print-button";
import { secondaryButton } from "@/components/ui";
import {
  CalendarIcon,
  CheckCircleSolidIcon,
  ChevronRightIcon,
  ClockIcon,
  MapPinIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons";
import {
  findEventForUser,
  getEventMembers,
  getEventOwner,
  getEventRole,
} from "@/lib/events";
import { getEventAgenda } from "@/lib/agenda";
import { longDate, startTime } from "@/lib/event-format";
import { ROLE_LABELS } from "@/lib/roles";
import { getSessionUser } from "@/lib/session-cookie";
import { getEventTasks } from "@/lib/tasks";

export const instant = false;

function PrintSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <div className="h-10 w-32 animate-pulse rounded-xl bg-white/70" />
      <div className="h-[640px] animate-pulse rounded-2xl border border-[#e8e6de] bg-white" />
    </div>
  );
}

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

function SectionHeading({
  index,
  title,
  aside,
}: {
  index: string;
  title: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#ece9e1] pb-2.5">
      <h2 className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#193b30]">
        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#193b30] text-[10px] font-semibold tracking-normal text-orange-200">
          {index}
        </span>
        {title}
      </h2>
      {aside}
    </div>
  );
}

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-zinc-400 ring-1 ring-[#ece9e1] print:ring-zinc-300">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          {label}
        </dt>
        <dd className="mt-0.5 text-[12.5px] font-semibold leading-snug text-zinc-800">
          {value}
        </dd>
      </div>
    </div>
  );
}

async function PrintContent({ id }: { id: string }) {
  await connection();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [event, role] = await Promise.all([
    findEventForUser(id, user.id),
    getEventRole(id, user.id),
  ]);

  // The run sheet contains team contacts, tasks and the agenda, so it is
  // member-only even when the event itself is public.
  if (!event || !role) notFound();

  const [owner, tasks, members, agenda] = await Promise.all([
    getEventOwner(id),
    getEventTasks(id),
    getEventMembers(id),
    getEventAgenda(id),
  ]);

  const startsAt = new Date(event.startsAt);
  const openTasks = tasks.filter((task) => task.status === "open");
  const completedTasks = tasks.filter((task) => task.status === "done");
  const progress = tasks.length
    ? Math.round((completedTasks.length / tasks.length) * 100)
    : 0;
  const generatedOn = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2 print:max-w-none print:space-y-0 print:py-0">
      {/* Toolbar (screen only) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Link href={`/events/${id}`} className={secondaryButton}>
          <ChevronRightIcon className="h-3.5 w-3.5 rotate-180" />
          Back to event
        </Link>
        <div className="flex items-center gap-3">
          <p className="hidden text-[11.5px] text-zinc-400 sm:block">
            Formatted for A4 and Letter paper
          </p>
          <PrintButton />
        </div>
      </div>

      {/* Printable document */}
      <article className="overflow-hidden rounded-2xl border border-[#e8e6de] bg-white shadow-sm shadow-zinc-900/[0.03] print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        {/* Masthead */}
        <header className="relative overflow-hidden border-b border-[#e8e6de] bg-gradient-to-br from-[#fdfcf8] via-white to-[#f4f7f3] px-6 py-6 sm:px-8 print:border-[#d9d5cb] print:bg-white print:px-0 print:pt-0">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-24 h-52 w-52 rounded-full bg-gradient-to-br from-orange-100/70 to-emerald-100/50 blur-3xl print:hidden"
          />

          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#193b30] text-orange-200 shadow-sm print:bg-white print:text-[#193b30] print:ring-1 print:ring-[#193b30]">
                <CalendarIcon className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9a4c20]">
                  EventPulse
                </p>
                <p className="text-[11.5px] text-zinc-500">Operations run sheet</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#fff1e4] px-2.5 py-1 text-[10.5px] font-semibold text-[#9a4c20] ring-1 ring-[#f4d7bd] print:bg-white">
                {event.category}
              </span>
              <span className="rounded-full border border-[#e8e6de] bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Internal
              </span>
            </div>
          </div>

          <div className="relative mt-6">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#9a4c20]">
              Official event run sheet
            </p>
            <h1 className="mt-1.5 text-[26px] font-semibold leading-tight tracking-tight text-[#18231d] sm:text-[30px] print:text-[26px]">
              {event.title}
            </h1>
          </div>

          <dl className="relative mt-6 grid grid-cols-2 gap-4 border-t border-[#ece9e1] pt-5 sm:grid-cols-4">
            <MetaItem
              icon={<CalendarIcon className="h-3.5 w-3.5" />}
              label="Date"
              value={longDate.format(startsAt)}
            />
            <MetaItem
              icon={<ClockIcon className="h-3.5 w-3.5" />}
              label="Start time"
              value={startTime.format(startsAt)}
            />
            <MetaItem
              icon={<MapPinIcon className="h-3.5 w-3.5" />}
              label="Venue"
              value={event.venue || "Location TBD"}
            />
            <MetaItem
              icon={<UsersIcon className="h-3.5 w-3.5" />}
              label="Capacity"
              value={event.capacity ? `${event.capacity} guests` : "Unlimited"}
            />
          </dl>
        </header>

        <div className="space-y-7 px-6 py-7 sm:px-8 print:space-y-6 print:px-0 print:py-6">
          {/* Briefing */}
          <section className="print:break-inside-avoid">
            <SectionHeading index="01" title="Event briefing" />
            <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-zinc-600">
              {event.description || "No specific briefing notes provided."}
            </p>
          </section>

          {/* Schedule & Run Order */}
          <section className="print:break-inside-avoid">
            <SectionHeading
              index="02"
              title="Schedule & run order"
              aside={
                <span className="text-[11px] font-medium text-zinc-400">
                  {agenda.length} programmed {agenda.length === 1 ? "session" : "sessions"}
                </span>
              }
            />

            {agenda.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-[#eeebe3] print:border-[#d9d5cb]">
                <table className="w-full text-left text-[12px]">
                  <thead className="border-b border-[#ece9e1] bg-[#faf8f2] text-[10px] font-semibold uppercase tracking-wider text-zinc-500 print:bg-white">
                    <tr>
                      <th className="px-3.5 py-2.5">Time</th>
                      <th className="px-3.5 py-2.5">Session</th>
                      <th className="px-3.5 py-2.5">Location</th>
                      <th className="px-3.5 py-2.5">Speaker / Host</th>
                      <th className="px-3.5 py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f2efe8]">
                    {agenda.map((item) => {
                      const itemStart = new Date(item.startsAt);
                      const itemEnd = new Date(itemStart.getTime() + item.durationMinutes * 60 * 1000);
                      const timeStr = `${startTime.format(itemStart)} – ${startTime.format(itemEnd)}`;
                      return (
                        <tr key={item.id} className="print:break-inside-avoid">
                          <td className="whitespace-nowrap px-3.5 py-2.5 font-semibold text-zinc-800">
                            {timeStr}
                            <span className="block text-[10.5px] font-normal text-zinc-400">
                              {item.durationMinutes} min
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className="font-semibold text-zinc-900">{item.title}</span>
                            {item.description ? (
                              <p className="mt-0.5 text-[11px] text-zinc-500">{item.description}</p>
                            ) : null}
                          </td>
                          <td className="px-3.5 py-2.5 text-zinc-600">
                            {item.location || "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-zinc-600">
                            {item.speakerName || "—"}
                          </td>
                          <td className="px-3.5 py-2.5 text-right uppercase tracking-wider text-[10px] font-bold text-zinc-500">
                            {item.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-[#e5e2d9] px-3.5 py-3 text-[12px] text-zinc-400">
                <CalendarIcon className="h-4 w-4 text-zinc-300" />
                No specific schedule sessions entered yet. Event starts at {startTime.format(startsAt)}.
              </p>
            )}
          </section>

          {/* Team contacts */}
          <section className="print:break-inside-avoid">
            <SectionHeading
              index="03"
              title="Staff & contacts"
              aside={
                <span className="text-[11px] font-medium text-zinc-400">
                  {members.length + 1} people on the team
                </span>
              }
            />

            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl border border-[#eeebe3] bg-[#fcfbf8] px-3.5 py-3 print:bg-white">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#193b30] text-[11px] font-semibold text-white print:bg-white print:text-[#193b30] print:ring-1 print:ring-[#193b30]">
                  {initials(owner?.name ?? "Event Owner")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-semibold text-zinc-900">
                    {owner?.name ?? "Event Owner"}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {owner?.email ?? "No contact email"}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-[#fff1e4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#9a4c20] print:bg-white print:ring-1 print:ring-[#f4d7bd]">
                  Host
                </span>
              </div>

              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-xl border border-[#eeebe3] bg-[#fcfbf8] px-3.5 py-3 print:break-inside-avoid print:bg-white"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e9e4d9] text-[11px] font-semibold text-[#4b5a52] print:bg-white print:ring-1 print:ring-zinc-300">
                    {initials(member.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-zinc-900">
                      {member.name}
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {member.email}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-[#e8e6de]">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Checklist */}
          <section>
            <SectionHeading
              index="04"
              title="Operations checklist"
              aside={
                <div className="flex flex-col items-end gap-1.5">
                  <span className="text-[11px] font-medium text-zinc-500">
                    {completedTasks.length} of {tasks.length} complete ·{" "}
                    {openTasks.length} pending
                  </span>
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#ece9e1] print:ring-1 print:ring-zinc-300">
                    <div
                      className="h-full rounded-full bg-[#193b30]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              }
            />

            {tasks.length > 0 ? (
              <ul className="mt-2 divide-y divide-[#f2efe8]">
                {tasks.map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-3 py-2.5 print:break-inside-avoid"
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border text-[11px] font-bold ${
                        task.status === "done"
                          ? "border-[#193b30] bg-[#193b30] text-white"
                          : "border-zinc-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-[12.5px] font-medium leading-snug ${
                          task.status === "done"
                            ? "text-zinc-400 line-through"
                            : "text-zinc-800"
                        }`}
                      >
                        {task.title}
                      </p>
                      {task.notes ? (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                          {task.notes}
                        </p>
                      ) : null}
                    </div>
                    {task.assigneeName ? (
                      <span className="shrink-0 rounded-md bg-[#fcfbf8] px-2 py-0.5 text-[10.5px] font-medium text-zinc-600 ring-1 ring-[#eeebe3] print:bg-white">
                        {task.assigneeName}
                      </span>
                    ) : (
                      <span className="shrink-0 text-[10.5px] text-zinc-300">
                        Unassigned
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-[#e5e2d9] px-3.5 py-3 text-[12px] text-zinc-400">
                <CheckCircleSolidIcon className="h-4 w-4 text-zinc-300" />
                No tasks have been added to this event yet.
              </p>
            )}
          </section>

          {/* Notes */}
          <section className="print:break-inside-avoid">
            <SectionHeading index="05" title="Day-of notes" />
            <div className="mt-3 rounded-xl border border-[#e8e4da] px-4 py-3">
              <p className="text-[11px] text-zinc-400">
                Venue contacts, door codes, AV notes, or schedule changes.
              </p>
              <div aria-hidden="true" className="mt-2 space-y-6">
                <div className="h-px bg-[#ece9e1]" />
                <div className="h-px bg-[#ece9e1]" />
                <div className="h-px bg-[#ece9e1]" />
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="flex flex-col gap-2 border-t border-[#e8e6de] bg-[#fcfbf8] px-6 py-4 text-[10.5px] text-zinc-400 sm:flex-row sm:items-center sm:justify-between sm:px-8 print:bg-white print:px-0 print:pb-0">
          <span className="inline-flex items-center gap-1.5">
            <TicketIcon className="h-3.5 w-3.5 text-zinc-300" />
            Generated by EventPulse on {generatedOn}
          </span>
          <span className="font-semibold uppercase tracking-[0.14em]">
            Confidential • Internal use only
          </span>
        </footer>
      </article>
    </div>
  );
}

export default function PrintEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<PrintSkeleton />}>
      {params.then(({ id }) => (
        <PrintContent id={id} />
      ))}
    </Suspense>
  );
}
